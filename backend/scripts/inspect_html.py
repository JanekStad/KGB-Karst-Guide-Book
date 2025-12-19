"""
Helper script to inspect HTML structure of a webpage.
Use this to understand the structure before writing your scraper.
"""

import requests
from bs4 import BeautifulSoup


def inspect_html(url: str):
    """Fetch and display the HTML structure of a webpage."""
    response = requests.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    print("=" * 80)
    print("METHOD 1: Find all tables and their classes")
    print("=" * 80)
    tables = soup.find_all("table")
    print(f"\nFound {len(tables)} table(s):\n")

    for i, table in enumerate(tables, 1):
        table_classes = table.get("class")
        classes_list: list[str] = list(table_classes) if table_classes else []
        print(f"Table {i}:")
        print(f"  Classes: {classes_list}")
        print(f"  ID: {table.get('id', 'None')}")
        print(f"  First 200 chars of content: {str(table)[:200]}...")
        print()

    print("=" * 80)
    print("METHOD 2: Check if table with class 'list' exists")
    print("=" * 80)
    list_table = soup.find("table", {"class": "list"})
    if list_table:
        print("✓ Found table with class 'list'")
        print("\nFirst few rows:")
        rows = list_table.find_all("tr")[:5]  # First 5 rows
        for i, row in enumerate(rows, 1):
            print(f"\nRow {i}:")
            cells = row.find_all(["td", "th"])
            for j, cell in enumerate(cells):
                print(f"  Cell {j}: {cell.get_text(strip=True)[:50]}")
    else:
        print("✗ No table with class 'list' found")
        print("\nTrying to find similar tables...")
        # Try partial match
        all_tables = soup.find_all("table")
        for table in all_tables:
            table_classes = table.get("class")
            table_classes_list: list[str] = list(table_classes) if table_classes else []
            if table_classes_list and any(
                "list" in str(c).lower() for c in table_classes_list
            ):
                print(f"  Found table with classes: {table_classes_list}")

    print("\n" + "=" * 80)
    print("METHOD 3: Save full HTML to file for inspection")
    print("=" * 80)
    import os
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(backend_root, "page_source.html")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(soup.prettify())
    print(f"✓ Saved full HTML to '{output_path}'")
    print("  You can open this file in a browser or text editor to inspect it.")

    print("\n" + "=" * 80)
    print("METHOD 4: Display structure of first table found")
    print("=" * 80)
    if tables:
        first_table = tables[0]
        print("Structure of first table:")
        print(f"  Tag: {first_table.name}")
        first_table_classes = first_table.get("class")
        first_classes_list: list[str] = (
            list(first_table_classes) if first_table_classes else []
        )
        print(f"  Classes: {first_classes_list}")
        print(f"  Number of rows: {len(first_table.find_all('tr'))}")
        print("\n  First row structure:")
        first_row = first_table.find("tr")
        if first_row:
            cells = first_row.find_all(["td", "th"])
            print(f"    Number of cells: {len(cells)}")
            for i, cell in enumerate(cells):
                print(
                    f"    Cell {i}: tag={cell.name}, text='{cell.get_text(strip=True)[:30]}'"
                )


if __name__ == "__main__":
    # Example URL from your script
    url = "https://www.lezec.cz/cesty.php?csek=5661f26f75736f76792044ed7279h&cobl=486f6c9a74656e6eh"

    print(f"Inspecting: {url}\n")
    inspect_html(url)
