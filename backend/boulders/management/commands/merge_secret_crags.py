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

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from boulders.models import Area, Sector
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

        # Allowed areas that should NOT be merged
        allowed_areas = [
            "Holštejn",
            "Josefovské Údolí",
            "Rudice",
            "Skály V Údolí Říčky",
            "Sloup",
            "Vyvřelina",
            "Žleby",
        ]

        # Find all areas in Moravský Kras
        moravsky_kras_areas = Area.objects.all()

        # Filter out allowed areas
        secret_areas = moravsky_kras_areas.exclude(name__in=allowed_areas)

        if not secret_areas.exists():
            self.stdout.write(self.style.SUCCESS("No secret areas found to merge."))
            return

        self.stdout.write(
            self.style.SUCCESS(f"Found {secret_areas.count()} secret area(s) to merge:")
        )
        for area in secret_areas:
            problem_count = area.problems.count()
            self.stdout.write(f"  - {area.name} ({problem_count} problems)")

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

        # Calculate average coordinates for Secret Spot (from sectors)
        total_lat = Decimal("0")
        total_lon = Decimal("0")
        count = 0
        for area in secret_areas:
            # Get coordinates from sectors
            sectors = Sector.objects.filter(area=area)
            for sector in sectors:
                if sector.latitude and sector.longitude:
                    total_lat += sector.latitude
                    total_lon += sector.longitude
                    count += 1

        avg_lat = total_lat / count if count > 0 else Decimal("49.4")
        avg_lon = total_lon / count if count > 0 else Decimal("16.7")

        # Get or create Secret Spot area
        secret_spot_name = "Secret Spot"
        secret_spot_area, created = Area.objects.get_or_create(
            name=secret_spot_name,
            defaults={
                "description": "Merged secret areas from Moravský Kras (illegal climbing spots)",
                "is_secret": True,
                "created_by": user,
            },
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created area: {secret_spot_name}"))
        else:
            # Update existing Secret Spot to ensure it's marked as secret
            secret_spot_area.is_secret = True
            secret_spot_area.save()
            self.stdout.write(
                self.style.SUCCESS(f"Using existing area: {secret_spot_name}")
            )

        # Create a default sector for Secret Spot with coordinates
        secret_spot_sector, sector_created = Sector.objects.get_or_create(
            area=secret_spot_area,
            name=secret_spot_name,  # Sector name same as area
            defaults={
                "latitude": avg_lat,
                "longitude": avg_lon,
                "description": "Merged secret areas from Moravský Kras",
                "created_by": user,
            },
        )

        # Merge all secret areas into Secret Spot
        stats = {
            "problems_moved": 0,
            "sectors_moved": 0,
            "walls_moved": 0,
            "areas_deleted": 0,
        }

        with transaction.atomic():
            for area in secret_areas:
                if area.id == secret_spot_area.id:
                    # Skip if this is the Secret Spot itself
                    continue

                # Move all problems from this area to Secret Spot
                problems = area.problems.all()
                for problem in problems:
                    problem.area = secret_spot_area
                    # Move to secret spot sector if problem has a sector
                    if problem.sector:
                        problem.sector = secret_spot_sector
                    problem.save()
                    stats["problems_moved"] += 1

                # Move all sectors from this area to Secret Spot
                sectors = area.sectors.all()
                for sector in sectors:
                    # Check if a sector with this name already exists in Secret Spot
                    existing_sector = Sector.objects.filter(
                        area=secret_spot_area, name=sector.name
                    ).first()

                    if existing_sector:
                        # Rename the sector to include the original area name
                        new_name = f"{area.name} - {sector.name}"
                        if len(new_name) > 200:
                            max_area_len = 200 - len(sector.name) - 3
                            area_prefix = (
                                area.name[:max_area_len] if max_area_len > 0 else ""
                            )
                            new_name = f"{area_prefix} - {sector.name}"[:200]
                        sector.name = new_name
                        self.stdout.write(
                            self.style.WARNING(
                                f"  Renamed sector '{sector.name}' to avoid conflict"
                            )
                        )

                    sector.area = secret_spot_area
                    sector.save()
                    stats["sectors_moved"] += 1

                # Move all walls from sectors in this area
                for sector in sectors:
                    walls = sector.walls.all()
                    for wall in walls:
                        # Move wall to secret spot sector
                        wall.sector = secret_spot_sector
                        wall.save()
                        stats["walls_moved"] += 1

                # Delete the area (cascades to sectors and walls)
                area.delete()
                stats["areas_deleted"] += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Merged and deleted area: {area.name}")
                )

        # Print summary
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 50))
        self.stdout.write(self.style.SUCCESS("Merge Summary:"))
        self.stdout.write(self.style.SUCCESS("=" * 50))
        self.stdout.write(f'Problems moved: {stats["problems_moved"]}')
        self.stdout.write(f'Sectors moved: {stats["sectors_moved"]}')
        self.stdout.write(f'Walls moved: {stats["walls_moved"]}')
        self.stdout.write(f'Areas deleted: {stats["areas_deleted"]}')
        self.stdout.write(
            self.style.SUCCESS(
                f'\nSecret Spot area "{secret_spot_name}" now contains all merged areas and is marked as secret.'
            )
        )
