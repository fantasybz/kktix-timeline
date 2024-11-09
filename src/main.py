"""
Main script for KKTIX orders
"""

import os
import sys
import webbrowser
from json import JSONDecodeError
from pathlib import Path

from dotenv import load_dotenv
from selenium.common.exceptions import WebDriverException

from scraper import KKTIXScraper
from utils import setup_logger

load_dotenv()  # Load environment variables from .env file

def copy_and_update_timeline(dumps_dir, json_filename):
    """Copy timeline files and update with JSON data"""
    # Read JSON data
    json_path = Path(dumps_dir) / json_filename
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = f.read()
    
    # Copy all template files
    src_dir = Path(__file__).parent
    for filename in ['timeline.html', 'styles.css', 'timeline.js']:
        src_path = src_dir / filename
        dst_path = Path(dumps_dir) / filename
        
        # Read template content
        with open(src_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Replace data injection placeholder if it's the HTML file
        if filename == 'timeline.html':
            content = content.replace(
                "// [TIMELINE_DATA_INJECTION]",
                f"const timelineData = {json_data};"
            )
        
        # Write updated content to destination
        with open(dst_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    return Path(dumps_dir) / 'timeline.html'

def main():
    """Main execution function for KKTIX order processing and visualization."""
    logger = setup_logger()
    scraper = None
    
    try:
        scraper = KKTIXScraper()
        scraper.login()
        orders = scraper.get_order_details()
        
        # Get the JSON filename that was created
        json_filename = scraper.latest_json_filename
        
        # Copy and update timeline template
        timeline_path = copy_and_update_timeline(scraper.dumps_dir, json_filename)
        
        # Convert path to file URL
        file_url = f'file://{os.path.abspath(timeline_path)}'
        
        # Open timeline in default browser
        webbrowser.open(file_url)
        
        logger.info("Successfully processed %d orders", len(orders))
        logger.info("Timeline visualization opened at: %s", file_url)
        
        return 0
        
    except (IOError, WebDriverException, JSONDecodeError) as e:
        logger.error("Error in main: %s", str(e))
        return 1
    finally:
        if scraper:
            scraper.quit()

if __name__ == "__main__":
    sys.exit(main())
