from scraper import KKTIXScraper
from utils import setup_logger
import sys
from dotenv import load_dotenv
import os
import webbrowser
from pathlib import Path

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
        
        logger.info(f"Successfully processed {len(orders)} orders")
        logger.info(f"Timeline visualization opened at: {file_url}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Error in main: {str(e)}")
        return 1
    finally:
        if scraper:
            scraper.quit()

if __name__ == "__main__":
    sys.exit(main()) 