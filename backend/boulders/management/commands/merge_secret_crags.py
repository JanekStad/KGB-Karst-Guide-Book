"""
Django management command to merge secret crags in Moravský Kras into one "Secret Spot" crag.

This command:
1. Identifies all crags in Moravský Kras (name contains "Moravský" or "Kras")
2. Filters out allowed crags: ["Holštejn", "Josefovské Údolí", "Rudice", "Skály V Údolí Říčky", "Sloup", "Vyvřelina"]
3. Merges all secret crags into one "Secret Spot" crag
4. Marks the "Secret Spot" crag as secret

Usage:
    python manage.py merge_secret_crags
    python manage.py merge_secret_crags --dry-run
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User
from django.db import transaction
from boulders.models import Crag, BoulderProblem, Wall
from decimal import Decimal


class Command(BaseCommand):
    help = "Merge secret crags in Moravský Kras into one Secret Spot crag"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be merged without actually merging",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="admin",
            help="Username to assign as creator of Secret Spot crag (default: admin)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        username = options["user"]

        # Allowed crags that should NOT be merged
        allowed_crags = [
            "Holštejn",
            "Josefovské Údolí",
            "Rudice",
            "Skály V Údolí Říčky",
            "Sloup",
            "Vyvřelina",
            "Žleby",
        ]

        # Find all crags in Moravský Kras
        moravsky_kras_crags = Crag.objects.all()

        # Filter out allowed crags
        secret_crags = moravsky_kras_crags.exclude(name__in=allowed_crags)

        if not secret_crags.exists():
            self.stdout.write(
                self.style.SUCCESS("No secret crags found to merge.")
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Found {secret_crags.count()} secret crag(s) to merge:"
            )
        )
        for crag in secret_crags:
            problem_count = crag.problems.count()
            self.stdout.write(f"  - {crag.name} ({problem_count} problems)")

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\nDRY RUN - No data will be modified. Run without --dry-run to perform the merge."
                )
            )
            return

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
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user: {username}"))

        # Calculate average coordinates for Secret Spot
        total_lat = Decimal("0")
        total_lon = Decimal("0")
        count = 0
        for crag in secret_crags:
            if crag.latitude and crag.longitude:
                total_lat += crag.latitude
                total_lon += crag.longitude
                count += 1

        avg_lat = total_lat / count if count > 0 else Decimal("49.4")
        avg_lon = total_lon / count if count > 0 else Decimal("16.7")

        # Get or create Secret Spot crag
        secret_spot_name = "Secret Spot"
        secret_spot, created = Crag.objects.get_or_create(
            name=secret_spot_name,
            defaults={
                "latitude": avg_lat,
                "longitude": avg_lon,
                "description": "Merged secret crags from Moravský Kras (illegal climbing spots)",
                "is_secret": True,
                "created_by": user,
            },
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f"Created crag: {secret_spot_name}")
            )
        else:
            # Update existing Secret Spot to ensure it's marked as secret
            secret_spot.is_secret = True
            secret_spot.save()
            self.stdout.write(
                self.style.SUCCESS(f"Using existing crag: {secret_spot_name}")
            )

        # Merge all secret crags into Secret Spot
        stats = {
            "problems_moved": 0,
            "walls_moved": 0,
            "crags_deleted": 0,
        }

        with transaction.atomic():
            for crag in secret_crags:
                if crag.id == secret_spot.id:
                    # Skip if this is the Secret Spot itself
                    continue

                # Move all problems from this crag to Secret Spot
                problems = crag.problems.all()
                for problem in problems:
                    problem.crag = secret_spot
                    problem.save()
                    stats["problems_moved"] += 1

                # Move all walls from this crag to Secret Spot
                # Handle duplicate wall names by renaming them
                walls = crag.walls.all()
                for wall in walls:
                    original_name = wall.name
                    # Check if a wall with this name already exists in Secret Spot
                    existing_wall = Wall.objects.filter(
                        crag=secret_spot, name=original_name
                    ).first()
                    
                    if existing_wall:
                        # Rename the wall to include the original crag name
                        new_name = f"{crag.name} - {original_name}"
                        # Ensure we don't exceed the 200 character limit
                        if len(new_name) > 200:
                            # Truncate the crag name part if needed
                            max_crag_len = 200 - len(original_name) - 3  # 3 for " - "
                            crag_prefix = crag.name[:max_crag_len] if max_crag_len > 0 else ""
                            new_name = f"{crag_prefix} - {original_name}"[:200]
                        wall.name = new_name
                        self.stdout.write(
                            self.style.WARNING(
                                f"  Renamed wall '{original_name}' to '{wall.name}' to avoid conflict"
                            )
                        )
                    
                    wall.crag = secret_spot
                    wall.save()
                    stats["walls_moved"] += 1

                # Delete the crag
                crag.delete()
                stats["crags_deleted"] += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Merged and deleted crag: {crag.name}")
                )

        # Print summary
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 50))
        self.stdout.write(self.style.SUCCESS("Merge Summary:"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(f'Problems moved: {stats["problems_moved"]}')
        self.stdout.write(f'Walls moved: {stats["walls_moved"]}')
        self.stdout.write(f'Crags deleted: {stats["crags_deleted"]}')
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSecret Spot crag "{secret_spot_name}" now contains all merged crags and is marked as secret.'
            )
        )

