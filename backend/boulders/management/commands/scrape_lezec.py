"""
Django management command to scrape boulder problems from lezec.cz.

This script:
1. Fetches the list of boulders from https://www.lezec.cz/cesty.php
2. Extracts boulder IDs and basic information (name, grade, sector, area, location)
3. Optionally fetches detailed information for each boulder

Usage:
    python manage.py scrape_lezec --output boulders_list.json
    python manage.py scrape_lezec --output boulders_list.json --fetch-details
    python manage.py scrape_lezec --output boulders_list.json --fetch-details --limit 10
    python manage.py scrape_lezec --output boulders_list.json --type boulder
    python manage.py scrape_lezec --output boulders_list.json --type boulder --location 199
    
Location IDs (examples):
    - 0: All locations
    - 199: Moravský Kras
    - 316: Střední Čechy
    - 159: Lužické Hory
    (See the website's location dropdown for full list)
"""

import json
import time
from urllib.parse import urljoin, urlparse, parse_qs

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import Crag, BoulderProblem
import requests
from bs4 import BeautifulSoup


class Command(BaseCommand):
    help = "Scrape boulder problems from lezec.cz"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            help="Output JSON file path to save scraped data",
        )
        parser.add_argument(
            "--fetch-details",
            action="store_true",
            help="Fetch detailed information for each boulder (slower)",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit number of boulders to scrape (useful for testing)",
        )
        parser.add_argument(
            "--type",
            type=str,
            choices=["boulder", "skalni", "horska", "vse"],
            default="boulder",
            help="Type of routes to scrape: boulder, skalni (rock), horska (mountain), vse (all). Default: boulder",
        )
        parser.add_argument(
            "--location",
            type=int,
            default=None,
            help="Location ID to filter by (e.g., 199 for Moravský Kras, 0 for all). Default: 0 (all locations)",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=1.0,
            help="Delay between requests in seconds (default: 1.0). Be respectful to the server.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only fetch and display data without saving",
        )

    def handle(self, *args, **options):
        output_file = options.get("output")
        fetch_details = options.get("fetch_details", False)
        limit = options.get("limit")
        route_type = options.get("type", "boulder")
        location_id = options.get("location")
        delay = options.get("delay", 1.0)
        dry_run = options.get("dry_run", False)

        base_url = "https://www.lezec.cz"
        list_url = f"{base_url}/cesty.php"

        self.stdout.write(self.style.SUCCESS(f"Scraping from: {list_url}"))
        self.stdout.write(f"Route type: {route_type}")
        if location_id is not None:
            self.stdout.write(f"Location filter: {location_id}")
        else:
            self.stdout.write("Location filter: all (0)")
        if limit:
            self.stdout.write(f"Limit: {limit} boulders")
        if fetch_details:
            self.stdout.write(
                self.style.WARNING(
                    f"Fetching details (this will be slower, delay: {delay}s)"
                )
            )

        # Step 1: Fetch all pages and collect boulders
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Step 1: Fetching list of boulders (with pagination)...")
        self.stdout.write("=" * 50)

        # Build filter parameters
        filter_params = {}
        
        # Set route type filter
        if route_type == "boulder":
            filter_params["cchr"] = "1"
        elif route_type == "horska":
            filter_params["cchr"] = "2"
        elif route_type == "skalni":
            filter_params["cchr"] = "4"
        # else: don't set cchr (all types)
        
        # Set location filter
        if location_id is not None:
            filter_params["cpol"] = str(location_id)
        else:
            filter_params["cpol"] = "0"  # All locations

        # Fetch first page to get pagination info
        try:
            response = requests.post(list_url, data=filter_params, timeout=30)
            response.raise_for_status()
            response.encoding = "utf-8"
        except requests.RequestException as e:
            raise CommandError(f"Failed to fetch list page: {e}")

        soup = BeautifulSoup(response.text, "html.parser")

        # Extract boulders from first page
        all_boulders = self._extract_boulder_list(soup, base_url, route_type)
        self.stdout.write(f"Page 1: Found {len(all_boulders)} boulders")

        # Find pagination links to determine total pages
        pagination_links = self._extract_pagination_links(soup, base_url)
        
        if pagination_links:
            self.stdout.write(f"Found {len(pagination_links)} additional pages")
            
            # Fetch remaining pages
            for page_num, page_url in enumerate(pagination_links, start=2):
                try:
                    time.sleep(delay)  # Be respectful between page requests
                    self.stdout.write(f"Fetching page {page_num}...")
                    
                    # Use GET for pagination links (they're already formatted URLs)
                    page_response = requests.get(page_url, timeout=30)
                    page_response.raise_for_status()
                    page_response.encoding = "utf-8"
                    
                    page_soup = BeautifulSoup(page_response.text, "html.parser")
                    page_boulders = self._extract_boulder_list(page_soup, base_url, route_type)
                    
                    if page_boulders:
                        all_boulders.extend(page_boulders)
                        self.stdout.write(f"  Page {page_num}: Found {len(page_boulders)} boulders (Total: {len(all_boulders)})")
                    else:
                        self.stdout.write(self.style.WARNING(f"  Page {page_num}: No boulders found"))
                        break  # Stop if we hit an empty page
                        
                except requests.RequestException as e:
                    self.stdout.write(
                        self.style.WARNING(f"  Failed to fetch page {page_num}: {e}. Continuing...")
                    )
                    continue

        if not all_boulders:
            raise CommandError("No boulders found on any page")

        self.stdout.write(
            self.style.SUCCESS(f"\nTotal boulders found across all pages: {len(all_boulders)}")
        )

        # Apply limit if specified
        if limit:
            all_boulders = all_boulders[:limit]
            self.stdout.write(f"Limited to {limit} boulders for processing")
        
        boulders = all_boulders

        # Step 2: Fetch details if requested
        if fetch_details:
            self.stdout.write("\n" + "=" * 50)
            self.stdout.write("Step 2: Fetching detailed information...")
            self.stdout.write("=" * 50)

            for i, boulder in enumerate(boulders, 1):
                self.stdout.write(
                    f"[{i}/{len(boulders)}] Fetching details for: {boulder.get('name', 'Unknown')} (ID: {boulder.get('id')})"
                )

                try:
                    details = self._fetch_boulder_details(
                        boulder["detail_url"], base_url
                    )
                    boulder.update(details)
                    time.sleep(delay)  # Be respectful to the server
                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Failed to fetch details: {e}. Continuing..."
                        )
                    )
                    boulder["detail_fetch_error"] = str(e)

        # Step 3: Save or display results
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Step 3: Results")
        self.stdout.write("=" * 50)

        if not dry_run and output_file:
            try:
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(boulders, f, ensure_ascii=False, indent=2)
                self.stdout.write(
                    self.style.SUCCESS(f"Saved {len(boulders)} boulders to: {output_file}")
                )
            except Exception as e:
                raise CommandError(f"Failed to save output file: {e}")
        elif dry_run:
            self.stdout.write(
                self.style.WARNING("DRY RUN - Displaying sample data:")
            )
            # Display first 3 boulders as sample
            for boulder in boulders[:3]:
                self.stdout.write(f"\n{json.dumps(boulder, ensure_ascii=False, indent=2)}")
            if len(boulders) > 3:
                self.stdout.write(f"\n... and {len(boulders) - 3} more boulders")
        else:
            # Display summary
            self.stdout.write(f"\nScraped {len(boulders)} boulders:")
            for boulder in boulders[:10]:
                name = boulder.get("name", "Unknown")
                grade = boulder.get("grade", "N/A")
                boulder_id = boulder.get("id", "N/A")
                self.stdout.write(f"  - {name} ({grade}) [ID: {boulder_id}]")
            if len(boulders) > 10:
                self.stdout.write(f"  ... and {len(boulders) - 10} more")

        self.stdout.write("\n" + self.style.SUCCESS("Scraping completed!"))

    def _extract_boulder_list(self, soup, base_url, route_type):
        """
        Extract list of boulders from the list page.

        The website has a main data table with structured route information.
        We need to find this table and extract boulders from it, not from
        all links on the page (which includes navigation, ads, etc.).

        Returns list of dicts with: id, name, grade, detail_url, sector, area, location
        """
        boulders = []

        # Find the main data table
        # The main table has many rows (>10) and structured data with multiple columns
        tables = soup.find_all("table")
        main_table = None

        for table in tables:
            rows = table.find_all("tr")
            if len(rows) > 10:  # Has many rows (likely the data table)
                # Check if it has the proper structure
                # Look for a data row (not header) with multiple cells
                for row in rows[1:6]:  # Skip potential header, check first few rows
                    cells = row.find_all(["td", "th"])
                    if len(cells) >= 5:  # Has multiple columns
                        first_cell_text = cells[0].get_text(strip=True)
                        # Check if first cell looks like a route name
                        # (not navigation text like "Metodika", "Knihy", etc.)
                        if (
                            first_cell_text
                            and len(first_cell_text) < 100
                            and first_cell_text
                            not in [
                                "Metodika",
                                "Knihy",
                                "Závody",
                                "Žebříček",
                                "Výsledky",
                                "Deníčky",
                                "Stěny",
                                "Prodejny",
                                "Kontakt",
                                "Databáze cest",
                                "Nové cesty",
                            ]
                        ):
                            # Check if this row has a route link
                            link = row.find("a", href=True)
                            if link and "cesta.php?key=" in link.get("href", ""):
                                main_table = table
                                break
                if main_table:
                    break

        if not main_table:
            self.stdout.write(
                self.style.WARNING(
                    "Could not find main data table. Falling back to link-based extraction."
                )
            )
            # Fallback to old method
            return self._extract_boulders_from_links(soup, base_url)

        # Extract boulders from the main table
        rows = main_table.find_all("tr")
        self.stdout.write(f"Found main data table with {len(rows)} rows")

        for row in rows:
            cells = row.find_all(["td", "th"])

            # Skip rows that don't have enough cells or are headers
            if len(cells) < 2:
                continue

            # Find the route link in this row
            link = row.find("a", href=True)
            if not link or "cesta.php?key=" not in link.get("href", ""):
                continue

            # Extract ID from URL
            href = link.get("href", "")
            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)
            query_params = parse_qs(parsed.query)
            boulder_id = query_params.get("key", [None])[0]

            if not boulder_id:
                continue

            # Extract data from table cells
            # Typical structure: Name, Grade, Sektor, Oblast, Poloha, ...
            cell_texts = [cell.get_text(strip=True) for cell in cells]

            # First cell is usually the name (or the link text)
            name = link.get_text(strip=True) or cell_texts[0] if cell_texts else None
            if not name:
                continue

            # Second cell is usually the grade
            grade = cell_texts[1] if len(cell_texts) > 1 else None

            # Third cell is usually the sector
            sector = cell_texts[2] if len(cell_texts) > 2 else None

            # Fourth cell is usually the area/oblast
            area = cell_texts[3] if len(cell_texts) > 3 else None

            # Fifth cell is usually the location/poloha
            location = cell_texts[4] if len(cell_texts) > 4 else None

            boulder_data = {
                "id": boulder_id,
                "name": name,
                "grade": grade,
                "detail_url": full_url,
                "source": "lezec.cz",
            }

            # Add optional fields if available
            if sector:
                boulder_data["sector"] = sector
            if area:
                boulder_data["area"] = area
            if location:
                boulder_data["location"] = location

            boulders.append(boulder_data)

        return boulders

    def _extract_boulders_from_links(self, soup, base_url):
        """
        Fallback method: Extract boulders from all links on the page.
        This is less accurate but works if we can't find the main table.
        """
        boulders = []
        links = soup.find_all("a", href=True)

        for link in links:
            href = link.get("href", "")
            if "cesta.php?key=" not in href:
                continue

            full_url = urljoin(base_url, href)
            parsed = urlparse(full_url)
            query_params = parse_qs(parsed.query)
            boulder_id = query_params.get("key", [None])[0]

            if not boulder_id:
                continue

            link_text = link.get_text(strip=True)
            if not link_text:
                continue

            parts = link_text.rsplit(" ", 1)
            if len(parts) == 2:
                name = parts[0].strip()
                grade = parts[1].strip()
            else:
                name = link_text
                grade = None

            boulder_data = {
                "id": boulder_id,
                "name": name,
                "grade": grade,
                "detail_url": full_url,
                "source": "lezec.cz",
            }

            boulders.append(boulder_data)

        return boulders

    def _extract_pagination_links(self, soup, base_url):
        """
        Extract pagination links from the page.
        
        Returns list of full URLs for pagination pages.
        Pagination uses 'lim' parameter (e.g., lim=100 for page 2, lim=200 for page 3).
        """
        pagination_links = []
        
        # Look for pagination section - usually in <small> tags with links
        # Find links that contain 'lim=' parameter
        all_links = soup.find_all("a", href=True)
        
        for link in all_links:
            href = link.get("href", "")
            if "cesty.php" in href and "lim=" in href:
                full_url = urljoin(base_url, href)
                # Avoid duplicates
                if full_url not in pagination_links:
                    pagination_links.append(full_url)
        
        # Sort by lim parameter value to process in order
        def get_lim_value(url):
            try:
                parsed = urlparse(url)
                query_params = parse_qs(parsed.query)
                lim = query_params.get("lim", ["0"])[0]
                return int(lim)
            except (ValueError, IndexError):
                return 0
        
        pagination_links.sort(key=get_lim_value)
        
        return pagination_links

    def _fetch_boulder_details(self, detail_url, base_url):
        """
        Fetch detailed information for a single boulder.

        Returns dict with additional fields like: description, location, author, etc.
        """
        import re

        try:
            response = requests.get(detail_url, timeout=30)
            response.raise_for_status()
            response.encoding = "utf-8"
        except requests.RequestException as e:
            raise Exception(f"HTTP error: {e}")

        soup = BeautifulSoup(response.text, "html.parser")
        details = {}

        # The page structure uses labels followed by values
        # Common pattern: "Label:" followed by value
        # We'll search for specific field labels and extract their values

        page_text = soup.get_text()

        # Helper function to extract field value after a label
        # Stop at next field label or end of text
        field_labels = [
            "Název cesty",
            "Klasifikace",
            "Typ cesty",
            "Sektor",
            "Oblast",
            "Poloha",
            "Obtíže",
            "Sklon",
            "Délka",
            "Autor",
            "Popis",
            "Poznámka",
            "Zapsal",
        ]

        def extract_field(label_pattern, text, max_length=200):
            """Extract value after a label pattern, stopping at next field label."""
            # Create pattern to match the label and capture value until next label
            label_pattern_escaped = re.escape(label_pattern)
            # Match the label, optional colon, then capture until next label or end
            next_labels_pattern = "|".join(
                [re.escape(label) for label in field_labels if label != label_pattern]
            )
            pattern = re.compile(
                rf"{label_pattern_escaped}\s*:?\s*((?:(?!{next_labels_pattern})[^\n\r])+)",
                re.IGNORECASE | re.DOTALL,
            )
            match = pattern.search(text)
            if match:
                value = match.group(1).strip()
                # Clean up value - remove extra whitespace and stop at next label
                value = re.sub(r"\s+", " ", value)
                # Remove any trailing field labels that might have been captured
                for label in field_labels:
                    if label != label_pattern and label in value:
                        value = value.split(label)[0].strip()
                        break
                if len(value) > max_length:
                    value = value[:max_length] + "..."
                return value if value else None
            return None

        # Extract structured fields
        field_mappings = {
            "description": [
                r"Popis",
                r"Description",
            ],
            "sector": [
                r"Sektor",
                r"Sector",
            ],
            "area": [
                r"Oblast",
                r"Area",
            ],
            "location": [
                r"Poloha",
                r"Lokalita",
                r"Location",
            ],
            "author": [
                r"Autor",
                r"Author",
                r"Založil",
            ],
            "difficulty": [
                r"Obtíže",
                r"Difficulty",
            ],
            "slope": [
                r"Sklon",
                r"Slope",
            ],
            "length": [
                r"Délka",
                r"Length",
            ],
            "note": [
                r"Poznámka",
                r"Note",
            ],
        }

        for field_name, patterns in field_mappings.items():
            for pattern in patterns:
                value = extract_field(pattern, page_text)
                if value:
                    details[field_name] = value
                    break

        # Extract route type (boulder, skalni, etc.)
        type_value = extract_field(r"Typ cesty", page_text, max_length=50)
        if type_value:
            type_lower = type_value.lower()
            if "boulder" in type_lower or "bouldr" in type_lower:
                details["route_type"] = "boulder"
            elif "skaln" in type_lower or "rock" in type_lower:
                details["route_type"] = "skalni"
            elif "horsk" in type_lower or "mountain" in type_lower:
                details["route_type"] = "horska"
            else:
                details["route_type"] = type_value

        # Extract grade (might be more accurate than from list page)
        grade_value = extract_field(r"Klasifikace", page_text, max_length=20)
        if grade_value:
            details["grade"] = grade_value

        # Extract coordinates if available
        # Look for GPS coordinates or map links
        coord_patterns = [
            r"(\d+\.\d+)[,\s]+(\d+\.\d+)",  # lat, lon
            r"N\s*(\d+\.\d+)[,\s]+E\s*(\d+\.\d+)",  # N lat, E lon
        ]

        for pattern in coord_patterns:
            matches = re.findall(pattern, page_text)
            if matches:
                try:
                    lat, lon = matches[0]
                    details["latitude"] = float(lat)
                    details["longitude"] = float(lon)
                    break
                except (ValueError, IndexError):
                    continue

        # Extract external links (filter out ads and common site links)
        external_links = []
        link_elements = soup.find_all("a", href=True)
        excluded_domains = [
            "lezec.cz",
            "kieroads.cz",
            "toplist.cz",
            "treking.cz",
            "megaubytko.cz",
            "megaubytovanie.sk",
            "navylet.cz",
            "energycloud.cz",
            "netpro.cz",
        ]

        for link in link_elements:
            href = link.get("href", "")
            if href.startswith("http"):
                domain = re.search(r"https?://([^/]+)", href)
                if domain and not any(
                    excluded in domain.group(1).lower()
                    for excluded in excluded_domains
                ):
                    label = link.get_text(strip=True) or "External Link"
                    if label and len(label) < 100:  # Filter out very long labels
                        external_links.append({"label": label, "url": href})

        if external_links:
            details["external_links"] = external_links

        # Extract video links
        video_links = []
        for link in link_elements:
            href = link.get("href", "")
            if any(
                domain in href.lower()
                for domain in ["youtube.com", "youtu.be", "vimeo.com"]
            ):
                label = link.get_text(strip=True) or "Video"
                video_links.append({"label": label, "url": href})
        if video_links:
            details["video_links"] = video_links

        return details

