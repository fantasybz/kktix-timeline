import logging
import sys
from datetime import datetime
import os

def setup_logger():
    # Create logs directory if it doesn't exist
    logs_dir = "logs"
    if not os.path.exists(logs_dir):
        os.makedirs(logs_dir)
    
    # Create logger with timestamp in filename
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    logger = logging.getLogger('kktix_scraper')
    
    # Set log level based on DEBUG environment variable
    debug_mode = os.getenv('KKTIX_DEBUG', 'false').lower() == 'true'
    logger.setLevel(logging.DEBUG if debug_mode else logging.INFO)
    
    # Prevent duplicate handlers
    if logger.handlers:
        return logger
    
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler with timestamp
    log_file = os.path.join(logs_dir, f'scraper_{timestamp}.log')
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger 