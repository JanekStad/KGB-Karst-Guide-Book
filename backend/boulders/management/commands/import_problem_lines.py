"""
Django management command to import problem lines from a JSON file.

The JSON file should have problem names as keys and arrays of coordinate points as values.
Each coordinate point should have 'x' and 'y' values (normalized 0-1).

Example JSON structure:
{
  "Kniha": [
    { "x": 0.05, "y": 0.63 },
    { "x": 0.18, "y": 0.60 }
  ],
  "Vlnová dálka": [
    { "x": 0.13, "y": 0.72 },
    { "x": 0.15, "y": 0.60 }
  ]
}

Usage:
    python manage.py import_problem_lines --file path/to/lines.json --image-id 1
    python manage.py import_problem_lines --file path/to/lines.json --image-id 1 --crag "Vanousy Kniha"
    python manage.py import_problem_lines --file path/to/lines.json --image-id 1 --dry-run
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from boulders.models import BoulderProblem, BoulderImage, ProblemLine, Crag
import json
import os


class Command(BaseCommand):
    help = "Import problem lines from a JSON file"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            type=str,
            required=True,
            help="Path to JSON file containing problem lines data",
        )
        parser.add_argument(
            "--image-id",
            type=int,
            help="ID of the BoulderImage to associate lines with",
        )
        parser.add_argument(
            "--crag",
            type=str,
            help="Optional: Crag name to filter problems (useful when problem names are not unique)",
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
        parser.add_argument(
            "--color",
            type=str,
            default="#FF0000",
            help="Hex color code for the lines (default: #FF0000)",
        )
        parser.add_argument(
            "--update-existing",
            action="store_true",
            help="Update existing ProblemLine entries instead of skipping them",
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        image_id = options.get("image_id")
        crag_name = options.get("crag")
        dry_run = options["dry_run"]
        username = options["user"]
        color = options["color"]
        update_existing = options["update_existing"]

        # Validate color format
        if not color.startswith("#") or len(color) != 7:
            raise CommandError(
                f"Invalid color format: {color}. Must be a hex color (e.g., #FF0000)"
            )

        # Check if file exists
        if not os.path.exists(file_path):
            raise CommandError(f"File not found: {file_path}")

        # Get or create user
        user = None
        if not dry_run:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(f'User "{username}" not found. Creating...')
                )
                user = User.objects.create_user(
                    username=username, email=f"{username}@example.com"
                )
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created user: {username}"))
        else:
            # In dry-run, try to get user but don't fail if not found
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f'User "{username}" not found. Will use None for dry-run.'
                    )
                )

        # Get the image
        if not image_id:
            raise CommandError("--image-id is required. Specify the BoulderImage ID.")

        try:
            image = BoulderImage.objects.get(id=image_id)
        except BoulderImage.DoesNotExist:
            raise CommandError(f"BoulderImage with ID {image_id} not found.")

        self.stdout.write(self.style.SUCCESS(f"Using image: {image} (ID: {image.id})"))

        # Load JSON data
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {e}")

        if not isinstance(data, dict):
            raise CommandError(
                "JSON file must contain a dictionary with problem names as keys"
            )

        # Statistics
        stats = {
            "lines_created": 0,
            "lines_updated": 0,
            "lines_skipped": 0,
            "problems_not_found": 0,
            "problems_multiple": 0,
        }

        # Process each problem
        for problem_name, coordinates in data.items():
            if not problem_name or not problem_name.strip():
                self.stdout.write(self.style.WARNING(f"Skipping empty problem name"))
                continue

            problem_name = problem_name.strip()

            # Validate coordinates
            if not isinstance(coordinates, list):
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - coordinates must be a list'
                    )
                )
                stats["problems_not_found"] += 1
                continue

            if len(coordinates) == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - no coordinates provided'
                    )
                )
                stats["problems_not_found"] += 1
                continue

            # Validate coordinate format
            valid_coords = True
            for coord in coordinates:
                if not isinstance(coord, dict) or "x" not in coord or "y" not in coord:
                    valid_coords = False
                    break
                try:
                    float(coord["x"])
                    float(coord["y"])
                except (ValueError, TypeError):
                    valid_coords = False
                    break

            if not valid_coords:
                self.stdout.write(
                    self.style.WARNING(
                        f'Skipping "{problem_name}" - invalid coordinate format. Each coordinate must have "x" and "y" as numbers.'
                    )
                )
                stats["problems_not_found"] += 1
                continue

            # Find the problem using normalized name matching
            # This handles special characters and diacritics more safely
            crag = None
            if crag_name:
                try:
                    crag = Crag.objects.get(name=crag_name)
                except Crag.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(
                            f'Crag "{crag_name}" not found. Skipping "{problem_name}".'
                        )
                    )
                    stats["problems_not_found"] += 1
                    continue

            # Use normalized name matching for safer lookups
            problems = list(
                BoulderProblem.find_by_normalized_name(problem_name, crag=crag)
            )

            if len(problems) == 0:
                self.stdout.write(
                    self.style.WARNING(
                        f'Problem "{problem_name}" not found'
                        + (f' in crag "{crag_name}"' if crag_name else "")
                    )
                )
                stats["problems_not_found"] += 1
                continue

            if len(problems) > 1:
                self.stdout.write(
                    self.style.WARNING(
                        f'Multiple problems found with name "{problem_name}"'
                        + (f' in crag "{crag_name}"' if crag_name else "")
                        + f". Found {len(problems)} problems. Skipping."
                    )
                )
                stats["problems_multiple"] += 1
                continue

            problem = problems[0]

            # Check if ProblemLine already exists
            existing_line = ProblemLine.objects.filter(
                image=image, problem=problem
            ).first()

            if existing_line:
                if update_existing:
                    if not dry_run:
                        existing_line.coordinates = coordinates
                        existing_line.color = color
                        existing_line.save()
                        stats["lines_updated"] += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'Updated line for "{problem_name}" ({problem.id})'
                            )
                        )
                    else:
                        stats["lines_updated"] += 1
                        self.stdout.write(
                            f'Would update line for "{problem_name}" ({problem.id})'
                        )
                else:
                    stats["lines_skipped"] += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'Line already exists for "{problem_name}" ({problem.id}). Use --update-existing to update.'
                        )
                    )
            else:
                if not dry_run:
                    ProblemLine.objects.create(
                        image=image,
                        problem=problem,
                        coordinates=coordinates,
                        color=color,
                        created_by=user,
                    )
                    stats["lines_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Created line for "{problem_name}" ({problem.id}) with {len(coordinates)} points'
                        )
                    )
                else:
                    stats["lines_created"] += 1
                    self.stdout.write(
                        f'Would create line for "{problem_name}" ({problem.id}) with {len(coordinates)} points'
                    )

        # Print summary
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 50))
        self.stdout.write(self.style.SUCCESS("Import Summary:"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(f'Lines created: {stats["lines_created"]}')
        self.stdout.write(f'Lines updated: {stats["lines_updated"]}')
        self.stdout.write(f'Lines skipped (existing): {stats["lines_skipped"]}')
        self.stdout.write(f'Problems not found: {stats["problems_not_found"]}')
        self.stdout.write(
            f'Problems with multiple matches: {stats["problems_multiple"]}'
        )

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN - No data was actually imported")
            )
        else:
            self.stdout.write(self.style.SUCCESS("\nImport completed!"))
