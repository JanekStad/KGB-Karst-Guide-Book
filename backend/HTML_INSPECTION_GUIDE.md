# How to Inspect HTML Structure for Web Scraping

There are several ways to find out the HTML structure of a webpage. Here are the most common methods:

## Method 1: Browser Developer Tools (Easiest)

1. **Open the webpage in your browser** (Chrome, Firefox, Safari, etc.)
2. **Right-click on the element** you want to scrape (e.g., the table with routes)
3. **Select "Inspect" or "Inspect Element"**
4. The browser's Developer Tools will open showing:
   - The HTML structure
   - CSS classes and IDs
   - Element hierarchy

**Tips:**
- Look for the `<table>` tag and check its `class` attribute
- You can hover over elements in the HTML to highlight them on the page
- Use Ctrl+F (Cmd+F on Mac) to search for specific text or classes

## Method 2: View Page Source

1. **Right-click on the page** → "View Page Source" (or Ctrl+U / Cmd+U)
2. Search for `<table` to find all tables
3. Look for `class="list"` or similar attributes

**Note:** This shows the raw HTML, which might be harder to read than Developer Tools.

## Method 3: Use the Python Inspection Script

I've created `inspect_html.py` for you. Run it to automatically analyze the HTML:

```bash
cd backend
source venv/bin/activate
python inspect_html.py
```

This script will:
- Find all tables on the page
- Check if a table with class "list" exists
- Show the structure of tables found
- Save the full HTML to a file for manual inspection

## Method 4: Test Your Scraper with Debugging

Modify your scraper temporarily to print what it finds:

```python
import requests
from bs4 import BeautifulSoup

url = "your_url_here"
response = requests.get(url)
soup = BeautifulSoup(response.text, "html.parser")

# Check what tables exist
tables = soup.find_all("table")
print(f"Found {len(tables)} tables")
for i, table in enumerate(tables):
    print(f"Table {i}: classes={table.get('class')}")

# Try to find your target table
target_table = soup.find("table", {"class": "list"})
if target_table:
    print("✓ Found table with class 'list'")
    print(f"Number of rows: {len(target_table.find_all('tr'))}")
else:
    print("✗ Table with class 'list' not found")
    # Try alternative selectors
    print("\nTrying alternatives...")
    # Maybe it's a different class name?
    all_tables = soup.find_all("table")
    for table in all_tables:
        print(f"  Table classes: {table.get('class')}")
```

## Method 5: Use Browser Extensions

- **SelectorGadget** (Chrome extension): Click on elements to get CSS selectors
- **Web Scraper** (Chrome extension): Visual tool for building scrapers

## Common Issues & Solutions

### Problem: Table class name is different
**Solution:** Use the inspection script to see all available classes, then adjust your selector:
```python
# Instead of class="list", maybe it's:
table = soup.find("table", {"class": "routes-list"})
# Or use partial match:
table = soup.find("table", class_=lambda x: x and "list" in x)
```

### Problem: Table is loaded dynamically (JavaScript)
**Solution:** The table might be added by JavaScript after page load. In this case:
- Use Selenium instead of requests (for dynamic content)
- Or check if the site has an API endpoint
- Or look for the data in the page's JavaScript variables

### Problem: Table structure is different than expected
**Solution:** Inspect the actual structure:
```python
table = soup.find("table", {"class": "list"})
if table:
    rows = table.find_all("tr")
    print(f"First row structure:")
    first_row = rows[0]
    cells = first_row.find_all(["td", "th"])
    for i, cell in enumerate(cells):
        print(f"  Cell {i}: {cell.get_text(strip=True)}")
```

## Quick Test Command

To quickly check if your selector works:

```python
python -c "
import requests
from bs4 import BeautifulSoup
url = 'YOUR_URL_HERE'
soup = BeautifulSoup(requests.get(url).text, 'html.parser')
table = soup.find('table', {'class': 'list'})
print('Found!' if table else 'Not found')
"
```

