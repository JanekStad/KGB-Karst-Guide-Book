"""
Django management command to import boulder problems from a JSON file.

Usage:
    python manage.py import_problems --file path/to/problems.json
    python manage.py import_problems --file path/to/problems.json --crag-lat 49.123456 --crag-lon 16.654321
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import Crag, Wall, BoulderProblem
import json
import os


class Command(BaseCommand):
    help = "Import boulder problems from a JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            required=True,
            help="Path to JSON file containing problems data",
        )
        parser.add_argument(
            "--crag-lat",
            type=float,
            default=49.4,
            help="Default latitude for crags (default: 49.4)",
        )
        parser.add_argument(
            "--crag-lon",
            type=float,
            default=16.7,
            help="Default longitude for crags (default: 16.7)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be imported without actually importing",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="admin",
            help="Username to assign as creator (default: admin)",
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        default_lat = options["crag_lat"]
        default_lon = options["crag_lon"]
        dry_run = options["dry_run"]
        username = options["user"]

        # Check if file exists
        if not os.path.exists(file_path):
            raise CommandError(f"File not found: {file_path}")

        # Get or create user
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.WARNING(f'User "{username}" not found. Creating...')
            )
            user = User.objects.create_user(
                username=username, email=f"{username}@example.com"
            )
            if not dry_run:
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created user: {username}"))

        # Load JSON data
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {e}")

        if not isinstance(data, list):
            raise CommandError("JSON file must contain a list of problems")

        # Statistics
        stats = {
            "crags_created": 0,
            "crags_existing": 0,
            "walls_created": 0,
            "walls_existing": 0,
            "problems_created": 0,
            "problems_existing": 0,
            "problems_skipped": 0,
        }

        # Process each problem
        for item in data:
            problem_name = item.get("name", "").strip()
            grade = item.get("grade", "").strip()
            crag_name = item.get("crag", "").strip()
            wall_name = item.get("wall", "").strip()
            city = item.get("city", "").strip()
            location = item.get("location", "").strip()

            if not problem_name:
                self.stdout.write(
                    self.style.WARNING(f"Skipping item with no name: {item}")
                )
                stats["problems_skipped"] += 1
                continue

            if not crag_name:
                self.stdout.write(
                    self.style.WARNING(f'Skipping "{problem_name}" - no crag name')
                )
                stats["problems_skipped"] += 1
                continue

            # Handle grade ranges (e.g., "8A/8A+", "6C+/7A")
            # Take the first grade if it's a range
            if "/" in grade:
                grade = grade.split("/")[0].strip()

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

            # Get or create crag
            crag, created = Crag.objects.get_or_create(
                name=crag_name,
                defaults={
                    "latitude": default_lat,
                    "longitude": default_lon,
                    "description": (
                        f"Located in {city}, {location}" if city or location else ""
                    ),
                    "created_by": user,
                },
            )
            if created:
                stats["crags_created"] += 1
                self.stdout.write(self.style.SUCCESS(f"Created crag: {crag_name}"))
            else:
                stats["crags_existing"] += 1

            # Get or create wall if specified
            wall = None
            if wall_name:
                wall, created = Wall.objects.get_or_create(
                    crag=crag,
                    name=wall_name,
                    defaults={
                        "created_by": user,
                    },
                )
                if created:
                    stats["walls_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(f"Created wall: {crag_name} - {wall_name}")
                    )
                else:
                    stats["walls_existing"] += 1

            # Create problem
            if not dry_run:
                problem, created = BoulderProblem.objects.get_or_create(
                    crag=crag,
                    name=problem_name,
                    defaults={
                        "grade": grade,
                        "wall": wall,
                        "created_by": user,
                    },
                )
                if created:
                    stats["problems_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created problem: {problem_name} ({grade}) at {crag_name}"
                        )
                    )
                else:
                    stats["problems_existing"] += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Problem already exists: {problem_name} at {crag_name}"
                        )
                    )
            else:
                # Dry run - just check if it would be created
                exists = BoulderProblem.objects.filter(
                    crag=crag, name=problem_name
                ).exists()
                if exists:
                    stats["problems_existing"] += 1
                    self.stdout.write(
                        f"Would skip (exists): {problem_name} at {crag_name}"
                    )
                else:
                    stats["problems_created"] += 1
                    self.stdout.write(
                        f"Would create: {problem_name} ({grade}) at {crag_name}"
                    )

        # Print summary
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 50))
        self.stdout.write(self.style.SUCCESS("Import Summary:"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(f'Crags created: {stats["crags_created"]}')
        self.stdout.write(f'Crags existing: {stats["crags_existing"]}')
        self.stdout.write(f'Walls created: {stats["walls_created"]}')
        self.stdout.write(f'Walls existing: {stats["walls_existing"]}')
        self.stdout.write(f'Problems created: {stats["problems_created"]}')
        self.stdout.write(f'Problems existing: {stats["problems_existing"]}')
        self.stdout.write(f'Problems skipped: {stats["problems_skipped"]}')

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN - No data was actually imported")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nImport completed!"))
