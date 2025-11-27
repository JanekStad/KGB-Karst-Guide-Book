"""
Django management command to scrape author and description from lezec.cz for existing boulder problems.

This script:
1. Finds all boulder problems with lezec.cz external links
2. Scrapes each lezec.cz page to extract:
   - Author (Autor) - extracts name and date (e.g., "Martin Švec 21.10.2017")
     - Strips date from author name for User matching
     - Optionally updates created_at with establishment date (--update-created-at)
   - Description (Popis)
3. Updates the boulder problems in the database

Usage:
    python manage.py scrape_lezec_metadata
    python manage.py scrape_lezec_metadata --dry-run
    python manage.py scrape_lezec_metadata --limit 10
    python manage.py scrape_lezec_metadata --delay 2.0
    python manage.py scrape_lezec_metadata --update-created-at
"""

import re
import time
from datetime import datetime
from urllib.parse import urlparse, parse_qs

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import BoulderProblem
import requests
from bs4 import BeautifulSoup


class Command(BaseCommand):
    help = "Scrape author and description from lezec.cz for existing boulder problems"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be updated without actually updating",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit number of boulders to process (for testing)",
        )
        parser.add_argument(
            "--delay",
            type=float,
            default=1.0,
            help="Delay between requests in seconds (default: 1.0)",
        )
        parser.add_argument(
            "--skip-existing",
            action="store_true",
            help="Skip boulders that already have description and author set",
        )
        parser.add_argument(
            "--update-created-at",
            action="store_true",
            help="Update created_at field with date from author field if available",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        limit = options.get("limit")
        delay = options.get("delay", 1.0)
        skip_existing = options.get("skip_existing", False)
        update_created_at = options.get("update_created_at", False)

        self.stdout.write("=" * 60)
        self.stdout.write("Scraping author and description from lezec.cz")
        self.stdout.write("=" * 60)

        # Find all boulder problems with lezec.cz external links
        all_problems = BoulderProblem.objects.all()
        problems_with_lezec_links = []

        for problem in all_problems:
            if not problem.external_links:
                continue
            for link in problem.external_links:
                link_url = link.get("url", "")
                if link_url and "lezec.cz" in link_url and "cesta.php?key=" in link_url:
                    problems_with_lezec_links.append((problem, link_url))
                    break

        if not problems_with_lezec_links:
            self.stdout.write(
                self.style.WARNING("No boulder problems with lezec.cz links found")
            )
            return

        self.stdout.write(
            f"Found {len(problems_with_lezec_links)} boulder problems with lezec.cz links"
        )

        if limit:
            problems_with_lezec_links = problems_with_lezec_links[:limit]
            self.stdout.write(f"Processing first {limit} problems (--limit specified)")

        if skip_existing:
            filtered = []
            for problem, url in problems_with_lezec_links:
                # Skip if has description AND (has author User OR has author_name)
                if not problem.description or (not problem.author and not problem.author_name):
                    filtered.append((problem, url))
                else:
                    self.stdout.write(
                        f"Skipping {problem.name} - already has description and author information"
                    )
            problems_with_lezec_links = filtered
            self.stdout.write(
                f"After filtering, {len(problems_with_lezec_links)} problems to process"
            )

        stats = {
            "processed": 0,
            "updated": 0,
            "author_matched": 0,
            "author_not_found": 0,
            "description_added": 0,
            "created_at_updated": 0,
            "errors": 0,
        }

        for problem, lezec_url in problems_with_lezec_links:
            self.stdout.write(f"\nProcessing: {problem.name} ({problem.grade})")
            self.stdout.write(f"  URL: {lezec_url}")

            try:
                # Scrape the page
                author_raw, description = self._scrape_lezec_page(lezec_url)

                if not author_raw and not description:
                    self.stdout.write(
                        self.style.WARNING("  No author or description found on page")
                    )
                    stats["processed"] += 1
                    continue

                # Extract date from author string and clean author name
                author_name = None
                establishment_date = None
                if author_raw:
                    author_name, establishment_date = self._parse_author_with_date(
                        author_raw
                    )
                    if establishment_date and author_name:
                        self.stdout.write(
                            f"  Found author: {author_name} (date: {establishment_date.strftime('%d.%m.%Y')})"
                        )
                    elif establishment_date and not author_name:
                        self.stdout.write(
                            f"  Found date only (no author name): {establishment_date.strftime('%d.%m.%Y')}"
                        )
                    elif author_name:
                        self.stdout.write(f"  Found author: {author_name}")
                    else:
                        # Couldn't parse author or date
                        self.stdout.write(
                            f"  Found author field (could not parse): {author_raw}"
                        )

                # Update author if found
                author_user = None
                if author_name:
                    # Try to match to Django User by username
                    try:
                        author_user = User.objects.get(username=author_name)
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  ✓ Matched author to User: {author_user.username}"
                            )
                        )
                        stats["author_matched"] += 1
                    except User.DoesNotExist:
                        # Try case-insensitive match
                        try:
                            author_user = User.objects.get(
                                username__iexact=author_name
                            )
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f"  ✓ Matched author (case-insensitive) to User: {author_user.username}"
                                )
                            )
                            stats["author_matched"] += 1
                        except User.DoesNotExist:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"  ⚠️  Author '{author_name}' not found in Django users"
                                )
                            )
                            stats["author_not_found"] += 1

                # Update description if found
                if description:
                    self.stdout.write(f"  Found description: {description[:100]}...")
                    stats["description_added"] += 1

                # Update the boulder problem
                if not dry_run:
                    updated_fields = []
                    update_created_at_value = None

                    if author_user and (
                        not problem.author or problem.author != author_user
                    ):
                        problem.author = author_user
                        problem.author_name = ""  # Clear author_name if User is set
                        updated_fields.append("author")
                        updated_fields.append("author_name")
                    elif author_name and not author_user:
                        # Store author as string if no User match found
                        if not problem.author_name or problem.author_name != author_name:
                            problem.author_name = author_name
                            updated_fields.append("author_name")
                    if description and (
                        not problem.description or problem.description != description
                    ):
                        problem.description = description
                        updated_fields.append("description")
                    if (
                        update_created_at
                        and establishment_date
                        and problem.created_at.date() != establishment_date
                    ):
                        # Note: created_at is auto_now_add, so we need to update it via update()
                        # to bypass the auto_now_add behavior
                        from django.utils import timezone

                        # Combine date with current time to preserve time component
                        new_datetime = timezone.make_aware(
                            datetime.combine(
                                establishment_date, problem.created_at.time()
                            )
                        )
                        update_created_at_value = new_datetime
                        updated_fields.append("created_at")
                        stats["created_at_updated"] += 1

                    if updated_fields:
                        # Save regular fields first
                        if "created_at" not in updated_fields:
                            problem.save()
                        else:
                            # If we need to update created_at, save other fields first,
                            # then use update() to bypass auto_now_add
                            regular_fields = [
                                f for f in updated_fields if f != "created_at"
                            ]
                            if regular_fields:
                                problem.save()
                            # Update created_at separately using update() to bypass auto_now_add
                            BoulderProblem.objects.filter(pk=problem.pk).update(
                                created_at=update_created_at_value
                            )
                            # Refresh from DB to get updated created_at
                            problem.refresh_from_db()

                        self.stdout.write(
                            self.style.SUCCESS(
                                f"  ✓ Updated boulder problem ({', '.join(updated_fields)})"
                            )
                        )
                        stats["updated"] += 1
                    else:
                        self.stdout.write("  No changes needed")
                else:
                    would_update = []
                    if author_user and not problem.author:
                        would_update.append(f"Author: {author_user.username}")
                    elif author_user and problem.author != author_user:
                        would_update.append(
                            f"Author: {problem.author.username if problem.author else problem.author_name or 'None'} -> {author_user.username}"
                        )
                    elif author_name and not author_user:
                        would_update.append(f"Author name: {author_name}")
                    if description and not problem.description:
                        would_update.append(f"Description: {description[:100]}...")
                    elif description and problem.description != description:
                        would_update.append("Description: (would update)")
                    if (
                        update_created_at
                        and establishment_date
                        and problem.created_at.date() != establishment_date
                    ):
                        would_update.append(
                            f"Created at: {problem.created_at.date()} -> {establishment_date.strftime('%d.%m.%Y')}"
                        )

                    if would_update:
                        self.stdout.write("  [DRY RUN] Would update:")
                        for field in would_update:
                            self.stdout.write(f"    - {field}")
                        stats["updated"] += 1
                    else:
                        self.stdout.write("  [DRY RUN] No changes needed")

                stats["processed"] += 1

                # Delay between requests to be respectful
                if delay > 0:
                    time.sleep(delay)

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  ✗ Error processing {problem.name}: {e}")
                )
                stats["errors"] += 1
                stats["processed"] += 1
                continue

        # Summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Scraping Summary:")
        self.stdout.write("=" * 60)
        self.stdout.write(f"Problems processed: {stats['processed']}")
        self.stdout.write(f"Problems updated: {stats['updated']}")
        self.stdout.write(f"Authors matched: {stats['author_matched']}")
        self.stdout.write(f"Authors not found: {stats['author_not_found']}")
        self.stdout.write(f"Descriptions added: {stats['description_added']}")
        if update_created_at:
            self.stdout.write(
                f"Created dates updated: {stats['created_at_updated']}"
            )
        self.stdout.write(f"Errors: {stats['errors']}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN - No changes were actually made")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nScraping completed!"))

    def _scrape_lezec_page(self, url):
        """
        Scrape author and description from a lezec.cz boulder problem page.

        Args:
            url: URL to the lezec.cz page

        Returns:
            tuple: (author_name, description) - both can be None
        """
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            # Lezec.cz uses windows-1250 encoding (Czech/Central European)
            response.encoding = "windows-1250"
        except requests.RequestException as e:
            raise Exception(f"HTTP error: {e}")

        soup = BeautifulSoup(
            response.content, "html.parser", from_encoding="windows-1250"
        )
        page_text = soup.get_text()

        # Field labels to look for
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
            "Založil",
        ]

        def extract_field(label_pattern, text, max_length=None):
            """Extract value after a label pattern, stopping at next field label."""
            label_pattern_escaped = re.escape(label_pattern)
            # Create pattern to match all other labels
            next_labels_pattern = "|".join(
                [re.escape(label) for label in field_labels if label != label_pattern]
            )
            # Match the label, optional colon, then capture until next label or end
            pattern = re.compile(
                rf"{label_pattern_escaped}\s*:?\s*((?:(?!{next_labels_pattern})[^\n\r])+)",
                re.IGNORECASE | re.DOTALL,
            )
            match = pattern.search(text)
            if match:
                value = match.group(1).strip()
                # Clean up value - remove extra whitespace
                value = re.sub(r"\s+", " ", value)
                # Remove any trailing field labels that might have been captured
                for label in field_labels:
                    if label != label_pattern and label in value:
                        value = value.split(label)[0].strip()
                        break
                # Truncate if max_length specified
                if max_length and len(value) > max_length:
                    value = value[:max_length]
                return value if value else None
            return None

        # Extract author (try multiple labels)
        author_name = None
        author_patterns = ["Autor", "Založil", "Author"]
        for pattern in author_patterns:
            author_name = extract_field(pattern, page_text, max_length=150)
            if author_name:
                break

        # Extract description (Popis)
        description = extract_field("Popis", page_text)

        return author_name, description

    def _parse_author_with_date(self, author_string):
        """
        Parse author string that may contain a date in various formats:
        - "Martin Švec 21.10.2017" (DD.MM.YYYY)
        - "J. Novák, 2017" (comma-separated year)
        - "Asu, 2017" (comma-separated year)
        - "1991" (standalone year - rare, might be just a year)
        
        Args:
            author_string: Raw author string from lezec.cz
            
        Returns:
            tuple: (author_name, establishment_date) - date can be None
        """
        if not author_string:
            return None, None

        author_string = author_string.strip()

        # Pattern 1: Full date format at the end: DD.MM.YYYY or DD.MM.YY
        # Examples: "Martin Švec 21.10.2017", "T.Pilka 1.1.2017"
        date_pattern_full = r"\s+(\d{1,2}\.\d{1,2}\.\d{2,4})$"
        match = re.search(date_pattern_full, author_string)

        if match:
            date_str = match.group(1)
            author_name = author_string[: match.start()].strip()

            try:
                # Try DD.MM.YYYY format first
                if len(date_str.split(".")[-1]) == 4:
                    establishment_date = datetime.strptime(date_str, "%d.%m.%Y").date()
                else:
                    # Try DD.MM.YY format (assume 20YY)
                    establishment_date = datetime.strptime(date_str, "%d.%m.%y").date()
                    # Convert 2-digit year to 4-digit (e.g., 17 -> 2017)
                    if establishment_date.year < 2000:
                        establishment_date = establishment_date.replace(
                            year=establishment_date.year + 2000
                        )

                return author_name, establishment_date
            except ValueError:
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠️  Could not parse date '{date_str}' from author string"
                    )
                )
                return author_string.strip(), None

        # Pattern 2: Comma-separated year: ", YYYY" or ", YY" (with optional spaces)
        # Examples: "J. Novák, 2017", "Asu, 2017", "J. Novák , 2017", "Asu,2017"
        year_pattern_comma = r",\s*(\d{4})$|,\s*(\d{2})$"
        match = re.search(year_pattern_comma, author_string)

        if match:
            year_str = match.group(1) or match.group(2)
            author_name = author_string[: match.start()].strip()

            # Don't treat standalone year as author name
            if not author_name:
                return None, None

            try:
                if len(year_str) == 4:
                    year = int(year_str)
                else:
                    # 2-digit year, assume 20YY
                    year = int(year_str)
                    if year < 100:
                        year += 2000

                # Use January 1st as the date (since we only have the year)
                establishment_date = datetime(year, 1, 1).date()
                return author_name, establishment_date
            except (ValueError, TypeError):
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠️  Could not parse year '{year_str}' from author string"
                    )
                )
                return author_string.strip(), None

        # Pattern 3: Standalone year (only if the whole string is a 4-digit year)
        # Example: "1991" - extract the year for date, but no author name
        year_pattern_standalone = r"^\d{4}$"
        if re.match(year_pattern_standalone, author_string):
            try:
                year = int(author_string)
                # Use January 1st as the date (since we only have the year)
                establishment_date = datetime(year, 1, 1).date()
                # Return None for author name since it's just a year
                return None, establishment_date
            except ValueError:
                pass

        # No date found, return author name as-is
        return author_string.strip(), None

