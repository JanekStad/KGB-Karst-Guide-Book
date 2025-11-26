"""
Django management command to dump boulder-related data to a JSON fixture file.

This command exports all boulder-related models (Area, Sector, Wall, BoulderProblem, BoulderImage, ProblemLine)
to a JSON file that can be restored later using load_boulders command.

Usage:
    python manage.py dump_boulders
    python manage.py dump_boulders --output my_backup.json
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command
import os


class Command(BaseCommand):
    help = "Dump all boulder-related data to a JSON fixture file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default="boulders_fixture.json",
            help="Output file path (default: boulders_fixture.json)",
        )
        parser.add_argument(
            "--indent",
            type=int,
            default=2,
            help="JSON indentation level (default: 2)",
        )

    def handle(self, *args, **options):
        output_file = options["output"]
        indent = options["indent"]

        # Ensure output directory exists
        output_dir = os.path.dirname(output_file) if os.path.dirname(output_file) else "."
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)
            self.stdout.write(
                self.style.SUCCESS(f"Created directory: {output_dir}")
            )

        self.stdout.write("Dumping boulder data...")
        self.stdout.write(f"Output file: {output_file}")

        try:
            call_command(
                "dumpdata",
                "boulders",
                "--indent",
                str(indent),
                "--output",
                output_file,
                verbosity=0,  # Suppress dumpdata's own output
            )

            # Check if file was created and has content
            if os.path.exists(output_file):
                file_size = os.path.getsize(output_file)
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ Successfully dumped boulder data to {output_file} ({file_size:,} bytes)"
                    )
                )

                # Count objects in the fixture
                import json

                with open(output_file, "r") as f:
                    data = json.load(f)
                    count = len(data)
                    self.stdout.write(f"  Total objects: {count}")

                    # Count by type
                    from collections import Counter

                    types = Counter(item["model"] for item in data)
                    for model_type, count in types.items():
                        self.stdout.write(f"    - {model_type}: {count}")

            else:
                self.stdout.write(
                    self.style.ERROR(f"✗ Failed to create output file: {output_file}")
                )

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Error dumping data: {str(e)}")
            )
            raise

