"""
Django management command to scrape boulder problems from lezec.cz.

This script:
1. Fetches the list of boulders from https://www.lezec.cz/cesty.php
2. Extracts boulder IDs and basic information (name, grade, sector, area, location)
3. Optionally fetches detailed information for each boulder
4. Optionally imports boulders directly into the database with lezec.cz external links

Usage:
    # Scrape and save to JSON
    python manage.py scrape_lezec --output boulders_list.json
    python manage.py scrape_lezec --output boulders_list.json --fetch-details
    python manage.py scrape_lezec --output boulders_list.json --type boulder --location 199

    # Import directly to database (stores lezec.cz IDs for faster diary imports)
    python manage.py scrape_lezec --import --type boulder --location 199 --user admin --crag-lat 49.4 --crag-lon 16.7
    python manage.py scrape_lezec --import --type boulder --location 199 --limit 100 --user admin

Location IDs (examples):
    - 0: All locations
    - 199: Moravský Kras
    - 316: Střední Čechy
    - 159: Lužické Hory
    (See the website's location dropdown for full list)

Note: When using --import, boulders are stored with lezec.cz external links,
      making diary imports much faster since they can match by external ID.
"""

import json
import time
import unicodedata
from urllib.parse import urljoin, urlparse, parse_qs

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import Area, Sector, Wall, BoulderProblem
import requests
from bs4 import BeautifulSoup


class Command(BaseCommand):
    help = "Scrape boulder problems from lezec.cz"

    def _validate_and_clean_string(self, text, field_name="text"):
        """
        Validate and clean a string to ensure proper UTF-8 encoding.

        Args:
            text: The string to validate
            field_name: Name of the field for error reporting

        Returns:
            Cleaned string, or None if validation fails
        """
        if not text:
            return text

        # Ensure it's a string
        if not isinstance(text, str):
            try:
                text = str(text)
            except Exception:
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠️  {field_name}: Could not convert to string, skipping"
                    )
                )
                return None

        # First, try to fix common encoding patterns (this might fix issues)
        original_text = text
        text = self._try_fix_encoding(text)

        # Check if text can be properly encoded to UTF-8
        # This is the real test - if we can't encode it, it's corrupted
        try:
            text.encode("utf-8", errors="strict")
        except UnicodeEncodeError as e:
            self.stdout.write(
                self.style.ERROR(
                    f"  ❌ {field_name}: Cannot encode to UTF-8, skipping: {repr(text[:50])}"
                )
            )
            return None

        # Check for replacement characters - but only warn, don't skip
        # (The source HTML might have these, but we can still use the text)
        if "\ufffd" in text:
            self.stdout.write(
                self.style.WARNING(
                    f"  ⚠️  {field_name} contains replacement characters (from source): {repr(text[:50])}"
                )
            )
            # Don't skip - just warn. The text is still usable.

        # Normalize Unicode (NFC form)
        try:
            text = unicodedata.normalize("NFC", text)
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(
                    f"  ⚠️  {field_name}: Unicode normalization failed: {e}"
                )
            )

        # Validate UTF-8 encoding
        try:
            text.encode("utf-8")
        except UnicodeEncodeError as e:
            self.stdout.write(
                self.style.ERROR(f"  ❌ {field_name}: Invalid UTF-8 encoding: {e}")
            )
            return None

        return text.strip()

    def _try_fix_encoding(self, text):
        """Try to fix common encoding issues in a string."""
        import re

        # Common Czech character fixes
        fixes = [
            (r"Moravsk\s*[\ufffd]?\s*Kras", "Moravský Kras"),
            (r"Moravsk\s*[\ufffd]?\s*kras", "Moravský kras"),
            (r"Moravsk\s+Kras", "Moravský Kras"),
            (r"Moravsk\s+kras", "Moravský kras"),
            (r"Hol\s*[\ufffd]?\s*tejn", "Holtýn"),
            (r"Josefovsk\s*[\ufffd]?\s*[\ufffd]?\s*dol", "Josefovské údolí"),
        ]

        fixed = text
        for pattern, replacement in fixes:
            fixed = re.sub(pattern, replacement, fixed)

        return fixed

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
        parser.add_argument(
            "--import",
            action="store_true",
            dest="import_to_db",
            help="Import scraped boulders into the database (creates crags and problems)",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="admin",
            help="Username to assign as creator (default: admin). Required when using --import",
        )
        parser.add_argument(
            "--crag-lat",
            type=float,
            default=None,
            help="Default latitude for new crags (required when creating new crags)",
        )
        parser.add_argument(
            "--crag-lon",
            type=float,
            default=None,
            help="Default longitude for new areas/sectors (required when creating new areas/sectors)",
        )

    def handle(self, *args, **options):
        output_file = options.get("output")
        fetch_details = options.get("fetch_details", False)
        limit = options.get("limit")
        route_type = options.get("type", "boulder")
        location_id = options.get("location")
        delay = options.get("delay", 1.0)
        dry_run = options.get("dry_run", False)
        import_to_db = options.get("import_to_db", False)
        username = options.get("user", "admin")
        default_lat = options.get("crag_lat")
        default_lon = options.get("crag_lon")

        # Get or create user if importing
        user = None
        if import_to_db:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                if not dry_run:
                    user = User.objects.create_user(
                        username=username, email=f"{username}@example.com"
                    )
                    self.stdout.write(self.style.SUCCESS(f"Created user: {username}"))
                else:
                    raise CommandError(
                        f'User "{username}" not found. Create it first or use --user to specify existing user.'
                    )

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
            # Explicitly set UTF-8 encoding
            response.encoding = "utf-8"
            # Verify encoding
            if response.encoding.lower() != "utf-8":
                self.stdout.write(
                    self.style.WARNING(
                        f"Warning: Response encoding is {response.encoding}, forcing UTF-8"
                    )
                )
                response.encoding = "utf-8"
        except requests.RequestException as e:
            raise CommandError(f"Failed to fetch list page: {e}")

        # Parse with explicit UTF-8 handling
        soup = BeautifulSoup(response.content, "html.parser", from_encoding="utf-8")

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
                    if page_response.encoding.lower() != "utf-8":
                        page_response.encoding = "utf-8"

                    page_soup = BeautifulSoup(
                        page_response.content, "html.parser", from_encoding="utf-8"
                    )
                    page_boulders = self._extract_boulder_list(
                        page_soup, base_url, route_type
                    )

                    if page_boulders:
                        all_boulders.extend(page_boulders)
                        self.stdout.write(
                            f"  Page {page_num}: Found {len(page_boulders)} boulders (Total: {len(all_boulders)})"
                        )
                    else:
                        self.stdout.write(
                            self.style.WARNING(f"  Page {page_num}: No boulders found")
                        )
                        break  # Stop if we hit an empty page

                except requests.RequestException as e:
                    self.stdout.write(
                        self.style.WARNING(
                            f"  Failed to fetch page {page_num}: {e}. Continuing..."
                        )
                    )
                    continue

        if not all_boulders:
            raise CommandError("No boulders found on any page")

        self.stdout.write(
            self.style.SUCCESS(
                f"\nTotal boulders found across all pages: {len(all_boulders)}"
            )
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

        # Step 3: Import to database or save/display results
        self.stdout.write("\n" + "=" * 50)
        if import_to_db:
            self.stdout.write("Step 3: Importing boulders to database...")
        else:
            self.stdout.write("Step 3: Results")
        self.stdout.write("=" * 50)

        if import_to_db:
            if not user:
                raise CommandError(
                    "User is required for import. Use --user to specify."
                )

            # Set default coordinates if not provided
            if default_lat is None:
                default_lat = 49.4  # Default for Czech Republic
            if default_lon is None:
                default_lon = 16.7  # Default for Czech Republic

            stats = self._import_boulders_to_db(
                boulders, user, default_lat, default_lon, dry_run
            )

            # Print import summary
            self.stdout.write("\n" + "=" * 50)
            self.stdout.write("Import Summary:")
            self.stdout.write("=" * 50)
            self.stdout.write(f"Areas created: {stats['areas_created']}")
            self.stdout.write(f"Areas existing: {stats['areas_existing']}")
            self.stdout.write(f"Sectors created: {stats['sectors_created']}")
            self.stdout.write(f"Sectors existing: {stats['sectors_existing']}")
            if stats.get("walls_created", 0) > 0 or stats.get("walls_existing", 0) > 0:
                self.stdout.write(f"Walls created: {stats.get('walls_created', 0)}")
                self.stdout.write(f"Walls existing: {stats.get('walls_existing', 0)}")
            self.stdout.write(f"Problems created: {stats['problems_created']}")
            self.stdout.write(f"Problems existing: {stats['problems_existing']}")
            self.stdout.write(f"Problems skipped: {stats['problems_skipped']}")
            self.stdout.write(f"Problems updated: {stats['problems_updated']}")

            if dry_run:
                self.stdout.write(
                    self.style.WARNING("\nDRY RUN - No data was actually imported")
                )
            else:
                self.stdout.write(self.style.SUCCESS("\nImport completed!"))

        if not dry_run and output_file:
            try:
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(boulders, f, ensure_ascii=False, indent=2)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Saved {len(boulders)} boulders to: {output_file}"
                    )
                )
            except Exception as e:
                raise CommandError(f"Failed to save output file: {e}")
        elif dry_run and not import_to_db:
            self.stdout.write(self.style.WARNING("DRY RUN - Displaying sample data:"))
            # Display first 3 boulders as sample
            for boulder in boulders[:3]:
                self.stdout.write(
                    f"\n{json.dumps(boulder, ensure_ascii=False, indent=2)}"
                )
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

            # Validate and clean the name
            name = self._validate_and_clean_string(name, "name")
            if not name:
                continue

            # Second cell is usually the grade
            grade = cell_texts[1] if len(cell_texts) > 1 else None
            if grade:
                grade = self._validate_and_clean_string(grade, "grade")

            # Third cell is usually the sector
            sector = cell_texts[2] if len(cell_texts) > 2 else None
            if sector:
                sector = self._validate_and_clean_string(sector, "sector")

            # Fourth cell is usually the area/oblast
            area = cell_texts[3] if len(cell_texts) > 3 else None
            if area:
                area = self._validate_and_clean_string(area, "area")

            # Fifth cell is usually the location/poloha
            location = cell_texts[4] if len(cell_texts) > 4 else None
            if location:
                location = self._validate_and_clean_string(location, "location")

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
            if response.encoding.lower() != "utf-8":
                response.encoding = "utf-8"
        except requests.RequestException as e:
            raise Exception(f"HTTP error: {e}")

        soup = BeautifulSoup(response.content, "html.parser", from_encoding="utf-8")
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
                    excluded in domain.group(1).lower() for excluded in excluded_domains
                ):
                    label = link.get_text(strip=True) or "External Link"
                    if label:
                        label = self._validate_and_clean_string(
                            label, "external_link_label"
                        )
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
                if label:
                    label = self._validate_and_clean_string(label, "video_link_label")
                video_links.append({"label": label, "url": href})
        if video_links:
            details["video_links"] = video_links

        return details

    def _import_boulders_to_db(self, boulders, user, default_lat, default_lon, dry_run):
        """
        Import scraped boulders into the database.

        Returns statistics about the import.
        """
        from boulders.models import Area, Sector, Wall
        from boulders.utils import normalize_problem_name

        stats = {
            "areas_created": 0,
            "areas_existing": 0,
            "sectors_created": 0,
            "sectors_existing": 0,
            "walls_created": 0,
            "walls_existing": 0,
            "problems_created": 0,
            "problems_existing": 0,
            "problems_skipped": 0,
            "problems_updated": 0,
        }

        for boulder_data in boulders:
            # Validate and clean all string fields before processing
            problem_name = self._validate_and_clean_string(
                boulder_data.get("name"), "problem_name"
            )
            grade = self._validate_and_clean_string(boulder_data.get("grade"), "grade")
            area = self._validate_and_clean_string(
                boulder_data.get("area"), "area"
            )  # This is the crag name
            sector = self._validate_and_clean_string(
                boulder_data.get("sector"), "sector"
            )  # This could be a wall
            location = self._validate_and_clean_string(
                boulder_data.get("location"), "location"
            )
            boulder_id = boulder_data.get("id")
            detail_url = boulder_data.get("detail_url", "")
            description = self._validate_and_clean_string(
                boulder_data.get("description"), "description"
            )

            if not problem_name:
                stats["problems_skipped"] += 1
                continue

            # Use area as area name, fallback to location if area is empty
            area_name = area or location or "Unknown Area"
            if area_name == "Unknown Area":
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - no area information'
                    )
                )
                stats["problems_skipped"] += 1
                continue

            # Final validation of area_name before database operations
            area_name = self._validate_and_clean_string(area_name, "area_name")
            if not area_name or area_name == "Unknown Area":
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - invalid area name after validation'
                    )
                )
                stats["problems_skipped"] += 1
                continue

            # Skip if no grade
            if not grade:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - no grade information'
                    )
                )
                stats["problems_skipped"] += 1
                continue

            # Handle grade ranges (e.g., "8A/8A+", "6C+/7A")
            if "/" in grade:
                grade = grade.split("/")[0].strip()

            # Clean grade (remove brackets like [7B])
            if "[" in grade:
                grade = grade.split("[")[0].strip()

            # Validate grade
            valid_grades = [choice[0] for choice in BoulderProblem.GRADE_CHOICES]
            if grade not in valid_grades:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - invalid grade: {grade}'
                    )
                )
                stats["problems_skipped"] += 1
                continue

            # Prepare area description with validation
            area_description = (
                f"Imported from lezec.cz. Location: {location}"
                if location
                else "Imported from lezec.cz"
            )
            area_description = (
                self._validate_and_clean_string(area_description, "area_description")
                or "Imported from lezec.cz"
            )

            # Get or create area (no coordinates - coordinates go on Sector)
            area_obj, area_created = Area.objects.get_or_create(
                name=area_name,
                defaults={
                    "description": area_description,
                    "created_by": user,
                },
            )
            if area_created:
                stats["areas_created"] += 1
                self.stdout.write(self.style.SUCCESS(f"Created area: {area_name}"))
            else:
                stats["areas_existing"] += 1

            # Get or create sector (coordinates go here)
            # Use sector name from scraped data, or default to area name if no sector
            sector_name = sector if sector and sector != "-" else area_name
            sector_name = self._validate_and_clean_string(sector_name, "sector_name")

            if not sector_name:
                sector_name = area_name  # Fallback to area name

            # Validate coordinates
            if not default_lat or not default_lon:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - coordinates required for sector creation. Use --crag-lat and --crag-lon.'
                    )
                )
                stats["problems_skipped"] += 1
                continue

            sector_obj, sector_created = Sector.objects.get_or_create(
                area=area_obj,
                name=sector_name,
                defaults={
                    "latitude": default_lat,
                    "longitude": default_lon,
                    "description": f"Imported from lezec.cz",
                    "created_by": user,
                },
            )
            if sector_created:
                stats["sectors_created"] += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Created sector: {area_name} - {sector_name}")
                )
            else:
                stats["sectors_existing"] += 1

            # Wall is optional (sub-sector) - for now we'll skip creating walls
            # and just use sectors. Users can manually create walls later if needed.
            wall_obj = None

            # Prepare external link for lezec.cz
            lezec_link = {
                "label": "lezec.cz",
                "url": detail_url or f"https://www.lezec.cz/cesta.php?key={boulder_id}",
            }

            # Check if problem already exists
            existing_problem = BoulderProblem.objects.filter(
                area=area_obj, name=problem_name
            ).first()

            if existing_problem:
                # Update external links if lezec.cz link is not already present
                if existing_problem.external_links:
                    has_lezec_link = any(
                        link.get("url", "").endswith(f"key={boulder_id}")
                        or "lezec.cz" in link.get("url", "")
                        for link in existing_problem.external_links
                    )
                    if not has_lezec_link:
                        existing_problem.external_links.append(lezec_link)
                        if not dry_run:
                            existing_problem.save()
                        stats["problems_updated"] += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"Updated external link for: {problem_name}"
                            )
                        )
                else:
                    existing_problem.external_links = [lezec_link]
                    if not dry_run:
                        existing_problem.save()
                    stats["problems_updated"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"Added external link to: {problem_name}")
                    )
                stats["problems_existing"] += 1
            else:
                # Create new problem
                if not dry_run:
                    # Ensure description is validated (already done above, but double-check)
                    if description:
                        description = self._validate_and_clean_string(
                            description, "problem_description"
                        )
                    problem = BoulderProblem.objects.create(
                        area=area_obj,
                        sector=sector_obj,
                        wall=wall_obj,
                        name=problem_name,
                        grade=grade,
                        description=description or "",
                        external_links=[lezec_link],
                        created_by=user,
                    )
                    stats["problems_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created problem: {problem_name} ({grade}) at {area_name} - {sector_name}"
                        )
                    )
                else:
                    stats["problems_created"] += 1
                    self.stdout.write(
                        f"Would create: {problem_name} ({grade}) at {area_name} - {sector_name}"
                    )

        return stats
