# KKTIX Timeline Visualization

A Python tool that processes KKTIX event data to analyze event history, expenses, and learning hours.

## Overview
This project provides data processing for KKTIX event data, featuring:
- Event data extraction
- Expense calculations
- Learning hours tracking
- Data export capabilities

## Setup

### Prerequisites
- Python 3.8 or higher
- pip (Python package installer)

### Installation Steps
1. Clone the repository
```bash
git clone https://github.com/yourusername/kktix-timeline.git
```

2. Navigate to the project directory
```bash
cd kktix-timeline
```

3. Install required packages
```bash
pip install -r requirements.txt
```

### Environment Configuration
1. **Create and Configure Environment File**
   ```bash
   # Create .env file in project root
   touch .env
   ```

   Add the following to your `.env` file:
   ```env
   KKTIX_EMAIL=your_email@example.com
   KKTIX_PASSWORD=your_password
   KKTIX_HEADLESS=true
   KKTIX_DEBUG=false
   ```

   Environment variables explained:
   - `KKTIX_EMAIL`: Your KKTIX account email
   - `KKTIX_PASSWORD`: Your KKTIX account password
   - `KKTIX_HEADLESS`: Run browser in headless mode (no GUI)
   - `KKTIX_DEBUG`: Enable/disable debug logging

### Running the Script

1. **Execute the Python Script**
   ```bash
   python3 src/main.py
   ```
   The script will process your KKTIX data and generate output files

### Troubleshooting

1. **Environment Issues**
   ```bash
   # Verify environment variables are loaded
   python3 -c "import os; print(os.getenv('KKTIX_EMAIL'))"
   ```

2. **Authentication Issues**
   - Verify your KKTIX credentials are correct
   - Check if KKTIX service is accessible
   - Ensure no special characters in .env file are causing issues

3. **Browser Automation Issues**
   ```bash
   # Try disabling headless mode
   # Set in .env:
   KKTIX_HEADLESS=false
   KKTIX_DEBUG=true
   ```

## Features

### 1. Data Processing
- Event data extraction
- Date and time parsing
- Price calculation
- Learning hours computation

### 2. Data Analysis
- Total expenses calculation
- Learning hours tracking
- Event count
- Location statistics


## Technical Details

### Technologies Used
- Python 3.8+
- Selenium for web scraping
- pandas for data processing

