"""
Scraper for KKTIX orders
"""

import json
import os
import time
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, WebDriverException, NoSuchElementException
from dotenv import load_dotenv

from utils import setup_logger

class KKTIXScraper:
    """A web scraper for extracting order information from KKTIX accounts."""
    def __init__(self):
        self.logger = setup_logger()
        load_dotenv()  # Load environment variables
        
        # Setup Chrome options
        chrome_options = Options()
        
        # Check headless mode from environment variable with debug logging
        headless_env = os.getenv('KKTIX_HEADLESS', 'true')  # Default to 'true' if not set
        self.logger.debug("KKTIX_HEADLESS environment variable: %s", headless_env)
        
        # Handle None case and convert to boolean
        headless = str(headless_env).lower() == 'true' if headless_env is not None else True
        self.logger.debug("Headless mode enabled: %s", headless)
        
        if headless:
            chrome_options.add_argument('--headless=new')
            chrome_options.add_argument('--window-size=1920,1080')
            self.logger.info("Running in headless mode")
        else:
            self.logger.info("Running in visible mode")
        
        # Add debug logging for chrome options
        self.logger.debug("Chrome options arguments: %s", chrome_options.arguments)
        
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.base_url = "https://kktix.com/account/orders"
        
        # Create dumps directory with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.dumps_dir = f"dumps_{timestamp}"
        if not os.path.exists(self.dumps_dir):
            os.makedirs(self.dumps_dir)
        # Add this line
        self.latest_json_filename = None

    def login(self):
        """Automated login to KKTIX and navigate to orders page"""
        try:
            # Get credentials from environment variables
            email = os.getenv('KKTIX_EMAIL')
            password = os.getenv('KKTIX_PASSWORD')
            
            if not email or not password:
                raise ValueError("Missing KKTIX credentials in .env file")
            
            # Navigate to login page
            self.driver.get("https://kktix.com/users/sign_in")
            self.logger.info("Navigating to login page...")
            
            # Wait for login form
            email_input = self.wait_for_element(By.ID, "user_login")
            password_input = self.wait_for_element(By.ID, "user_password")
            
            # Input credentials
            email_input.send_keys(email)
            password_input.send_keys(password)
            
            # Click login button
            login_button = self.wait_for_element(By.NAME, "commit")
            login_button.click()
            
            # Wait for successful login and navigate to orders page
            self.logger.info("Login successful, navigating to orders page...")
            self.driver.get(self.base_url)
            
            # Wait for orders page to load with accounting rows
            self.wait_for_element(By.CLASS_NAME, "accounting-row", timeout=20)
            self.logger.info("Successfully loaded orders page")
            
        except Exception as e:
            self.logger.error("Login error: %s", str(e))
            raise

    def wait_for_element(self, by, value, timeout=10):
        """Helper method to wait for elements"""
        try:
            return WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((by, value))
            )
        except Exception as e:
            self.logger.error("Timeout waiting for element %s: %s", value, str(e))
            raise

    def capture_order_pages(self):
        """Capture screenshots of all order pages"""
        page = 1
        while True:
            try:
                # Wait for accounting rows to load
                self.wait_for_element(By.CLASS_NAME, "accounting-row", timeout=20)
                self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                time.sleep(1)  # Wait for any dynamic content
                
                # Set window size
                total_height = self.driver.execute_script("return document.body.scrollHeight")
                self.driver.set_window_size(1200, total_height + 100)  # Add padding
                
                # Check for next page
                next_buttons = self.driver.find_elements(By.CSS_SELECTOR, ".pagination a[rel='next']")
                if not next_buttons:
                    self.logger.info("Reached last page")
                    break
                
                next_buttons[0].click()
                time.sleep(2)
                page += 1
                
            except (TimeoutException, WebDriverException) as e:
                self.logger.error("Error on page %d: %s", page, str(e))
                break

    def dump_to_json(self, orders):
        """Dump orders data to JSON file"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_path = os.path.join(self.dumps_dir, f"orders_{timestamp}.json")
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(orders, f, ensure_ascii=False, indent=2)
                
            self.logger.info("Orders dumped to JSON: %s", json_path)
            return json_path
            
        except Exception as e:
            self.logger.error("Error dumping to JSON: %s", str(e))
            raise

    def get_order_details(self):
        """Extract order details from all pages"""
        orders = []
        page = 1
        
        while True:
            try:
                # Wait for accounting rows to load
                self.wait_for_element(By.CLASS_NAME, "accounting-row", timeout=20)
                order_elements = self.driver.find_elements(By.CLASS_NAME, "accounting-row")
                
                self.logger.info("Processing page %d", page)
                
                for order in order_elements:
                    try:
                        # Extract order number and thumbnail
                        order_number = order.find_element(By.CLASS_NAME, "subrow").text.strip('#')
                        thumbnail = order.find_element(By.CLASS_NAME, "thumb").get_attribute("src")
                        
                        # Extract event details - handle both linked and non-linked titles
                        event_element = order.find_element(By.CSS_SELECTOR, ".event-title h4.subrow")
                        # Try to find anchor tag first, if not found use h4 text directly
                        try:
                            event_link = event_element.find_element(By.TAG_NAME, "a")
                            event_title = event_link.text
                            event_url = event_link.get_attribute("href")
                        except NoSuchElementException:
                            event_title = event_element.text
                            event_url = None
                        
                        # Extract all details from dl.item
                        item_dl = order.find_element(By.CLASS_NAME, "item")
                        details = {}
                        
                        # Get all dt/dd pairs
                        dts = item_dl.find_elements(By.TAG_NAME, "dt")
                        dds = item_dl.find_elements(By.TAG_NAME, "dd")
                        
                        for dt, dd in zip(dts, dds):
                            key = dt.text.strip()
                            
                            # Handle different types of values
                            if key == "Amount":
                                price_element = dd.find_element(By.CLASS_NAME, "price")
                                if "Free" in price_element.text:
                                    value = "Free"
                                else:
                                    currency = price_element.find_element(By.CLASS_NAME, "currency").text
                                    amount = price_element.find_element(By.CLASS_NAME, "currency-value").text
                                    value = f"{currency}{amount}"
                            elif key == "State":
                                value = dd.text.strip()
                            elif key == "Receipt":
                                receipt_link = dd.find_element(By.TAG_NAME, "a")
                                value = {
                                    "number": receipt_link.text.strip(),
                                    "url": receipt_link.get_attribute("href")
                                }
                            else:
                                value = dd.text.strip()
                            
                            details[key] = value
                        
                        # Get action buttons
                        action_buttons = []
                        for button in order.find_elements(By.CSS_SELECTOR, ".col-action .btn"):
                            action_buttons.append({
                                "text": button.text.strip(),
                                "url": button.get_attribute("href"),
                                "disabled": button.get_attribute("disabled") is not None
                            })
                        
                        # Extract detailed time information from Check/Edit Details page
                        check_details_button = next(
                            (btn for btn in action_buttons if btn["text"] == "Check/Edit Details"),
                            None
                        )
                        
                        if check_details_button and not check_details_button["disabled"]:
                            try:
                                # Open new tab
                                self.driver.execute_script(f"window.open('{check_details_button['url']}', '_blank');")
                                
                                # Switch to new tab
                                self.driver.switch_to.window(self.driver.window_handles[-1])
                                
                                # Wait for time information to load using the correct XPath
                                time_element = self.wait_for_element(
                                    By.XPATH,
                                    '//*[@id="registrations_controller"]/div[1]/div[2]/div/div[1]/div/table/tbody/tr[1]/td',
                                    timeout=10
                                )
                                
                                if time_element:
                                    # Extract and format time information
                                    time_text = time_element.text.strip()
                                    
                                    # Remove "Add to Calendar" text
                                    time_text = time_text.replace("Add to Calendar", "").strip()
                                    
                                    # Get only the start time (everything before ~)
                                    start_time = time_text.split("~")[0].strip()
                                    
                                    # Store both original and start time
                                    details["Event Time"] = time_text
                                    details["Start Time"] = start_time
                                    
                                    self.logger.debug("Parsed times - Start: %s", start_time)
                                
                                # Close tab and switch back
                                self.driver.close()
                                self.driver.switch_to.window(self.driver.window_handles[0])
                                
                            except (TimeoutException, WebDriverException, NoSuchElementException) as e:
                                self.logger.warning("Error extracting detailed time for order %s: %s", order_number, str(e))
                                # Ensure we switch back to main tab even if there's an error
                                if len(self.driver.window_handles) > 1:
                                    self.driver.close()
                                    self.driver.switch_to.window(self.driver.window_handles[0])
                        
                        # Compile order information
                        order_info = {
                            "order_number": order_number,
                            "thumbnail_url": thumbnail,
                            "event_title": event_title,
                            "event_url": event_url,
                            "details": details,
                            "actions": action_buttons,
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        orders.append(order_info)
                        self.logger.info("Extracted order: %s", order_number)
                        
                    except (NoSuchElementException, TimeoutException, WebDriverException) as e:
                        self.logger.warning("Error extracting order details: %s", str(e))
                        continue
                
                # Check for next page
                next_buttons = self.driver.find_elements(By.CSS_SELECTOR, ".pagination a[rel='next']")
                if not next_buttons:
                    self.logger.info("Reached last page")
                    break
                    
                next_buttons[0].click()
                time.sleep(2)  # Wait for page load
                page += 1
                
            except (TimeoutException, WebDriverException) as e:
                self.logger.error("Browser error on page %d: %s", page, str(e))
                break
        
        # Create timestamp for the JSON filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.latest_json_filename = f"orders_{timestamp}.json"
        
        # Dump to JSON
        json_path = os.path.join(self.dumps_dir, self.latest_json_filename)
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(orders, f, ensure_ascii=False, indent=2)
            
        self.logger.info("Total orders collected: %d", len(orders))
        self.logger.info("Orders dumped to JSON: %s", json_path)
        return orders

    def quit(self):
        """Clean up resources"""
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser session closed successfully")
        except WebDriverException as e:
            self.logger.error("Error closing browser: %s", str(e))

    def dump_page_source(self):
        """Dump the current page HTML to a file for analysis"""
        try:
            # Wait for the main content to load
            self.wait_for_element(By.CLASS_NAME, "accounting-row", timeout=20)
            
            # Create dumps directory if it doesn't exist
            dumps_dir = "dumps"
            if not os.path.exists(dumps_dir):
                os.makedirs(dumps_dir)
            
            # Save HTML with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dump_path = os.path.join(dumps_dir, f"orders_page_{timestamp}.html")
            
            with open(dump_path, 'w', encoding='utf-8') as f:
                f.write(self.driver.page_source)
                
            self.logger.info("Page source dumped to: %s", dump_path)
            
        except Exception as e:
            self.logger.error("Error dumping page source: %s", str(e))
            raise
