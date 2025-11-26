"""
Django management command to check and fix encoding issues in the database.

This command:
1. Checks for corrupted UTF-8 data (replacement characters)
2. Attempts to fix data by re-encoding if possible
3. Reports any issues found

Usage:
    python manage.py fix_encoding --check
    python manage.py fix_encoding --fix
"""

from django.core.management.base import BaseCommand
from boulders.models import Area, Sector, BoulderProblem, City, Wall


class Command(BaseCommand):
    help = "Check and fix encoding issues in the database"

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Only check for encoding issues, don't fix",
        )
        parser.add_argument(
            "--fix",
            action="store_true",
            help="Attempt to fix encoding issues (use with caution)",
        )
        parser.add_argument(
            "--show-samples",
            type=int,
            default=10,
            help="Number of sample corrupted strings to show (default: 10)",
        )

    def handle(self, *args, **options):
        check_only = options["check"]
        fix = options["fix"]

        if not check_only and not fix:
            self.stdout.write(
                self.style.WARNING(
                    "Please specify --check or --fix. Use --check to see issues first."
                )
            )
            return

        issues_found = []
        issues_fixed = []

        # Check Areas
        self.stdout.write("\nChecking Areas...")
        for area in Area.objects.all():
            if self._has_encoding_issue(area.name):
                issues_found.append(("Area", area.id, "name", area.name))
                if fix:
                    fixed = self._try_fix_string(area.name)
                    if fixed and fixed != area.name:
                        # Save if we made any improvement (even if not perfect)
                        area.name = fixed
                        area.save()
                        issues_fixed.append(("Area", area.id, "name", fixed))

            if area.description and self._has_encoding_issue(area.description):
                issues_found.append(("Area", area.id, "description", area.description))
                if fix:
                    fixed = self._try_fix_string(area.description)
                    if fixed and fixed != area.description:
                        area.description = fixed
                        area.save()
                        issues_fixed.append(("Area", area.id, "description", fixed))

        # Check Sectors
        self.stdout.write("Checking Sectors...")
        for sector in Sector.objects.all():
            if self._has_encoding_issue(sector.name):
                issues_found.append(("Sector", sector.id, "name", sector.name))
                if fix:
                    fixed = self._try_fix_string(sector.name)
                    if fixed and fixed != sector.name:
                        sector.name = fixed
                        sector.save()
                        issues_fixed.append(("Sector", sector.id, "name", fixed))

            if sector.description and self._has_encoding_issue(sector.description):
                issues_found.append(("Sector", sector.id, "description", sector.description))
                if fix:
                    fixed = self._try_fix_string(sector.description)
                    if fixed and fixed != sector.description:
                        sector.description = fixed
                        sector.save()
                        issues_fixed.append(("Sector", sector.id, "description", fixed))

        # Check Cities
        self.stdout.write("Checking Cities...")
        for city in City.objects.all():
            if self._has_encoding_issue(city.name):
                issues_found.append(("City", city.id, "name", city.name))
                if fix:
                    fixed = self._try_fix_string(city.name)
                    if fixed and fixed != city.name:
                        city.name = fixed
                        city.save()
                        issues_fixed.append(("City", city.id, "name", fixed))

        # Check Walls
        self.stdout.write("Checking Walls...")
        for wall in Wall.objects.all():
            if self._has_encoding_issue(wall.name):
                issues_found.append(("Wall", wall.id, "name", wall.name))
                if fix:
                    fixed = self._try_fix_string(wall.name)
                    if fixed and fixed != wall.name:
                        wall.name = fixed
                        wall.save()
                        issues_fixed.append(("Wall", wall.id, "name", fixed))

        # Check BoulderProblems
        self.stdout.write("Checking BoulderProblems...")
        for problem in BoulderProblem.objects.all():
            if self._has_encoding_issue(problem.name):
                issues_found.append(
                    ("BoulderProblem", problem.id, "name", problem.name)
                )
                if fix:
                    fixed = self._try_fix_string(problem.name)
                    if fixed and fixed != problem.name:
                        problem.name = fixed
                        problem.save()
                        issues_fixed.append(
                            ("BoulderProblem", problem.id, "name", fixed)
                        )

            if problem.description and self._has_encoding_issue(problem.description):
                issues_found.append(
                    ("BoulderProblem", problem.id, "description", problem.description)
                )
                if fix:
                    fixed = self._try_fix_string(problem.description)
                    if fixed and fixed != problem.description:
                        problem.description = fixed
                        problem.save()
                        issues_fixed.append(
                            ("BoulderProblem", problem.id, "description", fixed)
                        )

        # Report results
        show_samples = options.get("show_samples", 10)
        self.stdout.write("\n" + "=" * 50)
        if check_only:
            self.stdout.write("Encoding Check Results:")
            self.stdout.write("=" * 50)
            if issues_found:
                self.stdout.write(
                    self.style.WARNING(f"Found {len(issues_found)} encoding issues:")
                )
                self.stdout.write("\nSample corrupted strings:")
                for model, obj_id, field, value in issues_found[:show_samples]:
                    # Show the corrupted string and try to show what it should be
                    corrupted_bytes = value.encode("utf-8", errors="replace")
                    self.stdout.write(f"  {model} #{obj_id}.{field}:")
                    self.stdout.write(f"    Corrupted: {repr(value)}")
                    self.stdout.write(f"    Bytes: {corrupted_bytes}")
                    # Try to show a fix attempt
                    fix_attempt = self._try_fix_string(value)
                    if fix_attempt != value:
                        self.stdout.write(f"    Fixed attempt: {repr(fix_attempt)}")
                    self.stdout.write("")
                if len(issues_found) > show_samples:
                    self.stdout.write(
                        f"  ... and {len(issues_found) - show_samples} more issues"
                    )
                self.stdout.write(
                    self.style.WARNING(
                        "\nRun with --fix to attempt to fix these issues."
                    )
                )
            else:
                self.stdout.write(self.style.SUCCESS("No encoding issues found!"))
        else:
            self.stdout.write("Encoding Fix Results:")
            self.stdout.write("=" * 50)
            if issues_found:
                self.stdout.write(
                    self.style.WARNING(f"Found {len(issues_found)} encoding issues")
                )
            if issues_fixed:
                self.stdout.write(
                    self.style.SUCCESS(f"Fixed {len(issues_fixed)} encoding issues:")
                )
                for model, obj_id, field, value in issues_fixed[:10]:
                    self.stdout.write(
                        f"  {model} #{obj_id}.{field}: {repr(value[:50])}"
                    )
                if len(issues_fixed) > 10:
                    self.stdout.write(f"  ... and {len(issues_fixed) - 10} more fixes")
            else:
                self.stdout.write(
                    self.style.WARNING("No issues could be automatically fixed.")
                )

    def _has_encoding_issue(self, text):
        """Check if text contains encoding issues (replacement characters)"""
        if not text:
            return False
        # Only flag if it actually contains replacement characters
        # Don't flag strings that are just plain ASCII or valid UTF-8
        return "\ufffd" in text or "" in text

    def _try_fix_string(self, text):
        """
        Attempt to fix encoding issues in a string using multiple strategies.
        This handles common encoding corruption patterns.
        """
        if not text:
            return text

        original = text
        import re

        # Strategy 1: Direct pattern replacements for known Czech words
        # These are the most reliable fixes
        patterns = [
            # Moravský Kras - most common issue
            (r"Moravsk\s*[\ufffd]?\s*Kras", "Moravský Kras"),
            (r"Moravsk\s*[\ufffd]?\s*kras", "Moravský kras"),
            (r"Moravsk\s+Kras", "Moravský Kras"),
            (r"Moravsk\s+kras", "Moravský kras"),
            (r"Moravsk\s*$", "Moravský"),
            (r"Moravsk(\s|$|[.,;:])", r"Moravský\1"),
            # Common Czech place names
            (r"Hol\s*[\ufffd]?\s*tejn", "Holtýn"),
            (r"Hol\s*[\ufffd]?\s*t\s*[\ufffd]?\s*jn", "Holtýn"),
            (
                r"Josefovsk\s*[\ufffd]?\s*[\ufffd]?\s*dol\s*[\ufffd]?",
                "Josefovské údolí",
            ),
            (r"Josefovsk\s+[\ufffd]?\s*dol", "Josefovské údolí"),
        ]

        fixed = text
        for pattern, replacement in patterns:
            fixed = re.sub(pattern, replacement, fixed)

        # Strategy 2: Try encoding recovery (if bytes were misread)
        if fixed == original and ("" in original or "\ufffd" in original):
            try:
                # Try to encode as latin-1 then decode as utf-8
                bytes_repr = original.encode("latin-1")
                decoded = bytes_repr.decode("utf-8", errors="replace")
                if decoded != original:
                    fixed = decoded
            except Exception:
                pass

        # Strategy 3: Generic Czech character fixes
        # If we see a pattern like "word replacement_char word", try common Czech chars
        if "" in fixed or "\ufffd" in fixed:
            # Common Czech character replacements in context
            czech_context_fixes = [
                (
                    r"(\w+)\s*[\ufffd]\s*tejn",
                    r"\1ýn",
                ),  # "Hol" + replacement + "tejn" -> "Holtýn"
                (
                    r"(\w+)\s*[\ufffd]\s*dol",
                    r"\1é údolí",
                ),  # "Josefovsk" + replacement + "dol" -> "Josefovské údolí"
            ]
            for pattern, replacement in czech_context_fixes:
                fixed = re.sub(pattern, replacement, fixed)

        # Strategy 4: If we made any changes, return the fixed version
        if fixed != original:
            return fixed

        return original  # Couldn't fix it
