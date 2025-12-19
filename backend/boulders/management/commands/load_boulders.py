"""
Django management command to load boulder-related data from a JSON fixture file.

This command imports boulder-related models (Area, Sector, Wall, BoulderProblem, BoulderImage, ProblemLine)
from a JSON file created by dump_boulders command.

Usage:
    python manage.py load_boulders
    python manage.py load_boulders --input fixtures/boulders_fixture.json
    python manage.py load_boulders --input fixtures/boulders_fixture.json --clear
"""

from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command
from django.db import transaction
import os


class Command(BaseCommand):
    help = "Load boulder-related data from a JSON fixture file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--input",
            type=str,
            default="fixtures/boulders_fixture.json",
            help="Input fixture file path (default: fixtures/boulders_fixture.json)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing boulder data before loading (WARNING: This will delete all areas, sectors, walls, problems, images, and problem lines)",
        )

    def handle(self, *args, **options):
        input_file = options["input"]
        clear = options["clear"]

        # Check if file exists
        if not os.path.exists(input_file):
            raise CommandError(f"Fixture file not found: {input_file}")

        # Check file size
        file_size = os.path.getsize(input_file)
        if file_size == 0:
            raise CommandError(f"Fixture file is empty: {input_file}")

        self.stdout.write(f"Loading boulder data from: {input_file}")
        self.stdout.write(f"File size: {file_size:,} bytes")

        # Clear existing data if requested
        if clear:
            self.stdout.write(
                self.style.WARNING(
                    "\n⚠️  WARNING: Clearing all existing boulder data..."
                )
            )
            from boulders.models import (
                Area,
                Sector,
                Wall,
                BoulderProblem,
                BoulderImage,
                ProblemLine,
            )

            with transaction.atomic():
                deleted_lines = ProblemLine.objects.all().delete()[0]
                deleted_problems = BoulderProblem.objects.all().delete()[0]
                deleted_images = BoulderImage.objects.all().delete()[0]
                deleted_walls = Wall.objects.all().delete()[0]
                deleted_sectors = Sector.objects.all().delete()[0]
                deleted_areas = Area.objects.all().delete()[0]

                self.stdout.write(f"  ✓ Deleted {deleted_lines} problem lines")
                self.stdout.write(f"  ✓ Deleted {deleted_problems} boulder problems")
                self.stdout.write(f"  ✓ Deleted {deleted_images} boulder images")
                self.stdout.write(f"  ✓ Deleted {deleted_walls} walls")
                self.stdout.write(f"  ✓ Deleted {deleted_sectors} sectors")
                self.stdout.write(f"  ✓ Deleted {deleted_areas} areas")

        # Count objects before loading
        from boulders.models import Area, Sector, Wall, BoulderProblem

        before_counts = {
            "areas": Area.objects.count(),
            "sectors": Sector.objects.count(),
            "walls": Wall.objects.count(),
            "problems": BoulderProblem.objects.count(),
        }

        self.stdout.write("\nLoading fixture...")

        try:
            call_command("loaddata", input_file, verbosity=0)

            # Count objects after loading
            after_counts = {
                "areas": Area.objects.count(),
                "sectors": Sector.objects.count(),
                "walls": Wall.objects.count(),
                "problems": BoulderProblem.objects.count(),
            }

            self.stdout.write(
                self.style.SUCCESS("\n✓ Successfully loaded boulder data!")
            )
            self.stdout.write("\nSummary:")
            self.stdout.write(
                f"  Areas: {before_counts['areas']} → {after_counts['areas']} (+{after_counts['areas'] - before_counts['areas']})"
            )
            self.stdout.write(
                f"  Sectors: {before_counts['sectors']} → {after_counts['sectors']} (+{after_counts['sectors'] - before_counts['sectors']})"
            )
            self.stdout.write(
                f"  Walls: {before_counts['walls']} → {after_counts['walls']} (+{after_counts['walls'] - before_counts['walls']})"
            )
            self.stdout.write(
                f"  Problems: {before_counts['problems']} → {after_counts['problems']} (+{after_counts['problems'] - before_counts['problems']})"
            )

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n✗ Error loading data: {str(e)}"))
            raise
