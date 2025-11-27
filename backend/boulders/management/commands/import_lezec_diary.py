"""
Django management command to import user ticks from lezec.cz public diary.

This script:
1. Fetches a user's public diary from lezec.cz
2. Filters for boulders only (bouldry)
3. Filters for boulders in Moravský Kras location
4. Matches boulders to our database
5. Creates ticks for the user

Usage:
    python manage.py import_lezec_diary --username Lucaa --user-id 1
    python manage.py import_lezec_diary --username Lucaa --user-id 1 --dry-run
"""

import json
import time
from datetime import datetime
from urllib.parse import urljoin, urlparse, parse_qs

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import Area, BoulderProblem
from lists.models import Tick
import requests
from bs4 import BeautifulSoup


class Command(BaseCommand):
    help = "Import user ticks from lezec.cz public diary"

    def add_arguments(self, parser):
        parser.add_argument(
            "--username",
            type=str,
            required=True,
            help="Lezec.cz username to import diary from",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            required=True,
            help="Django user ID to assign ticks to",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be imported without actually importing",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=1.0,
            help="Delay between requests in seconds (default: 1.0)",
        )

    def handle(self, *args, **options):
        lezec_username = options["username"]
        user_id = options["user_id"]
        dry_run = options.get("dry_run", False)
        delay = options.get("delay", 1.0)

        # Get Django user
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise CommandError(f"User with ID {user_id} not found")

        self.stdout.write(
            self.style.SUCCESS(f"Importing diary for lezec.cz user: {lezec_username}")
        )
        self.stdout.write(
            f"Assigning ticks to Django user: {user.username} (ID: {user_id})"
        )

        # Encode username to hex (lowercase)
        username_hex = "".join(f"{ord(c):02x}" for c in lezec_username)

        base_url = "https://www.lezec.cz"
        diary_url = f"{base_url}/denik.php"

        # Build URL with filters:
        # - par=1: show routes tab
        # - uid: hex-encoded username
        # - ckat=3: bouldry only
        # - cstl=0 or empty: all styles (vše)
        # - crok=9997: all years (vše)
        params = {
            "par": "1",
            "uid": f"{username_hex}h",
            "ckat": "3",  # bouldry
            "cstl": "0",  # all styles
            "crok": "9997",  # all years
        }

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Step 1: Fetching diary page...")
        self.stdout.write("=" * 50)

        try:
            response = requests.get(diary_url, params=params, timeout=30)
            response.raise_for_status()
            # Lezec.cz uses windows-1250 encoding (Czech/Central European)
            response.encoding = "windows-1250"
        except requests.RequestException as e:
            raise CommandError(f"Failed to fetch diary page: {e}")

        # Parse with explicit encoding handling
        soup = BeautifulSoup(
            response.content, "html.parser", from_encoding="windows-1250"
        )

        # Extract ticks from the diary
        ticks = self._extract_ticks_from_diary(soup, base_url)

        if not ticks:
            self.stdout.write(
                self.style.WARNING(
                    "No boulder ticks found in diary (or diary is not public)"
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(f"Found {len(ticks)} boulder ticks in diary")
        )

        # Filter for Moravský Kras only
        # Known areas in Moravský Kras: Panský Les, Sloup, Holštejn, Rudice, Ostrov, etc.
        moravsky_kras_areas = [
            "Holštejn",
            "Josefovské Údolí",
            "Rudice",
            "Skály V Údolí Říčky",
            "Sloup",
            "Vyvřelina",
            "Žleby",
        ]

        moravsky_kras_ticks = [
            tick
            for tick in ticks
            if tick.get("location") in moravsky_kras_areas
            or "Moravský" in tick.get("location", "")
            or "Kras" in tick.get("location", "")
        ]

        self.stdout.write(
            f"Filtered to {len(moravsky_kras_ticks)} ticks from Moravský Kras"
        )

        if not moravsky_kras_ticks:
            self.stdout.write(
                self.style.WARNING("No ticks found for Moravský Kras location")
            )
            return

        # Step 2: Match boulders and create ticks
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Step 2: Matching boulders and creating ticks...")
        self.stdout.write("=" * 50)

        stats = {
            "matched": 0,
            "created": 0,
            "existing": 0,
            "not_found": 0,
            "errors": 0,
        }

        for tick_data in moravsky_kras_ticks:
            boulder_name = tick_data.get("name")
            boulder_id = tick_data.get("lezec_id")
            date = tick_data.get("date")
            style = tick_data.get("style", "")

            self.stdout.write(
                f"\nProcessing: {boulder_name} ({tick_data.get('grade')}) - {date}"
            )

            # Try to find matching boulder problem
            problem = None

            # Strategy 1: Try by external link (lezec.cz ID) - fastest method
            if boulder_id:
                # SQLite doesn't support contains lookup for JSONField
                # So we'll iterate through boulders and check their external_links
                # But we can filter by area first to make it faster
                lezec_url = f"https://www.lezec.cz/cesta.php?key={boulder_id}"
                url_variations = [
                    lezec_url,
                    f"http://www.lezec.cz/cesta.php?key={boulder_id}",
                    f"cesta.php?key={boulder_id}",
                ]

                # Get Moravský Kras areas first to narrow down search
                moravsky_kras_areas = Area.objects.filter(
                    name__icontains="Moravský"
                ) | Area.objects.filter(name__icontains="Kras")

                # Also include areas that match the area from the tick
                tick_area = tick_data.get("location", "")
                if tick_area:
                    matching_areas = Area.objects.filter(name__icontains=tick_area)
                    moravsky_kras_areas = moravsky_kras_areas | matching_areas

                if moravsky_kras_areas.exists():
                    # Filter by area first (much faster than checking all boulders)
                    boulders_to_check = BoulderProblem.objects.filter(
                        area__in=moravsky_kras_areas
                    )
                else:
                    # Fallback to all boulders if no areas found
                    boulders_to_check = BoulderProblem.objects.all()

                # Check external_links for matching lezec.cz URL
                for boulder in boulders_to_check:
                    if not boulder.external_links:
                        continue
                    for link in boulder.external_links:
                        link_url = link.get("url", "")
                        # Check if URL contains the boulder ID
                        if link_url and f"key={boulder_id}" in link_url:
                            problem = boulder
                            self.stdout.write(
                                f"  ✓ Matched by external link (lezec.cz ID: {boulder_id})"
                            )
                            break
                    if problem:
                        break

            # Strategy 2: Try by name in Moravský Kras areas
            if not problem:
                # Find Moravský Kras areas
                moravsky_kras_areas = Area.objects.filter(
                    name__icontains="Moravský"
                ) | Area.objects.filter(name__icontains="Kras")

                if moravsky_kras_areas.exists():
                    # Try exact match first
                    for area in moravsky_kras_areas:
                        problem = BoulderProblem.find_by_normalized_name(
                            boulder_name, area=area
                        ).first()
                        if problem:
                            self.stdout.write(
                                f"  Matched by name '{boulder_name}' in area '{area.name}'"
                            )
                            break

                    # If still not found, try partial match
                    if not problem:
                        for area in moravsky_kras_areas:
                            problems = BoulderProblem.objects.filter(
                                area=area, name__icontains=boulder_name[:10]
                            )
                            if problems.exists():
                                problem = problems.first()
                                self.stdout.write(
                                    f"  Matched by partial name in area '{area.name}'"
                                )
                                break

            if not problem:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Boulder not found in database: {boulder_name}"
                    )
                )
                stats["not_found"] += 1
                continue

            stats["matched"] += 1

            # Check if tick already exists
            existing_tick = Tick.objects.filter(user=user, problem=problem).first()

            if existing_tick:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Tick already exists for {boulder_name} on {existing_tick.date}"
                    )
                )
                stats["existing"] += 1
                continue

            # Create tick
            if not dry_run:
                try:
                    notes = (
                        f"Imported from lezec.cz diary. Style: {style}"
                        if style
                        else "Imported from lezec.cz diary"
                    )

                    Tick.objects.create(
                        user=user,
                        problem=problem,
                        date=date,
                        notes=notes,
                    )
                    stats["created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"  ✓ Created tick for {boulder_name}")
                    )
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"  ✗ Error creating tick: {e}"))
                    stats["errors"] += 1
            else:
                stats["created"] += 1
                self.stdout.write(f"  Would create tick for {boulder_name} on {date}")

        # Summary
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Import Summary:")
        self.stdout.write("=" * 50)
        self.stdout.write(f"Boulders matched: {stats['matched']}")
        self.stdout.write(f"Ticks created: {stats['created']}")
        self.stdout.write(f"Ticks already existing: {stats['existing']}")
        self.stdout.write(f"Boulders not found: {stats['not_found']}")
        self.stdout.write(f"Errors: {stats['errors']}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN - No ticks were actually created")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nImport completed!"))

    def _extract_ticks_from_diary(self, soup, base_url):
        """
        Extract tick data from the diary page.

        Returns list of dicts with: name, lezec_id, grade, date, style, location
        """
        ticks = []

        # Find the main data table
        # The table has columns: Datum, Cesta, Oblast, Klas, Body, Styl, P
        tables = soup.find_all("table")
        main_table = None

        for table in tables:
            rows = table.find_all("tr")
            if len(rows) > 5:  # Has multiple data rows (not just header)
                # Check if this looks like the diary table
                # Look for header row with "Datum", "Cesta", "Klas", etc.
                header_row = rows[0]
                header_text = header_row.get_text()
                # Also check that it has proper structure (th elements)
                header_cells = header_row.find_all("th")
                if (
                    len(header_cells) >= 4
                    and "Datum" in header_text
                    and "Cesta" in header_text
                    and "Klas" in header_text
                ):
                    # Verify first data row has date format
                    if len(rows) > 1:
                        first_data_row = rows[1]
                        first_cell = first_data_row.find("td")
                        if first_cell:
                            first_cell_text = first_cell.get_text(strip=True)
                            # Check if it looks like a date (DD.MM.YYYY)
                            if "." in first_cell_text and len(first_cell_text) == 10:
                                main_table = table
                                break

        if not main_table:
            self.stdout.write(self.style.WARNING("Could not find diary data table"))
            return ticks

        rows = main_table.find_all("tr")

        # Skip header row
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])

            if len(cells) < 4:  # Need at least date, name, area, grade
                continue

            # Extract data from cells
            # Cell 0: Datum (Date)
            # Cell 1: Cesta (Route name with link)
            # Cell 2: Oblast (Area/Location)
            # Cell 3: Klas (Grade)
            # Cell 4: Body (Points)
            # Cell 5: Styl (Style)
            # Cell 6: P (some flag)

            date_str = cells[0].get_text(strip=True)
            if not date_str:
                continue

            # Parse date (format: DD.MM.YYYY)
            try:
                date = datetime.strptime(date_str, "%d.%m.%Y").date()
            except ValueError:
                self.stdout.write(
                    self.style.WARNING(f"Could not parse date: {date_str}")
                )
                continue

            # Extract route name and ID from link
            route_link = cells[1].find("a", href=True)
            if not route_link:
                continue

            route_name = route_link.get_text(strip=True)
            route_href = route_link.get("href", "")

            # Extract route ID from URL (cesta.php?key=XXXXX)
            route_id = None
            if "cesta.php?key=" in route_href:
                parsed = urlparse(urljoin(base_url, route_href))
                query_params = parse_qs(parsed.query)
                route_id = query_params.get("key", [None])[0]

            # Extract area/location
            location = cells[2].get_text(strip=True)

            # Extract grade
            grade = cells[3].get_text(strip=True) if len(cells) > 3 else None

            # Extract style
            style = cells[5].get_text(strip=True) if len(cells) > 5 else ""

            tick_data = {
                "name": route_name,
                "lezec_id": route_id,
                "grade": grade,
                "date": date,
                "style": style,
                "location": location,
            }

            ticks.append(tick_data)

        return ticks
