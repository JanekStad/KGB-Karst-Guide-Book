"""
Django management command to fix Lidomorna sectors structure.

The issue: "lidomorna", "lidomorna vlevo", and "lidomorna vpravo" are stored as separate sectors,
but they should be ONE sector "Lidomorna" with THREE walls: "vlevo", "vpravo", and main (no suffix).

This command:
1. Finds sectors matching "lidomorna", "lidomorna vlevo", "lidomorna vpravo" (case-insensitive)
2. Creates or uses the main "Lidomorna" sector
3. Creates walls: "vlevo", "vpravo", and optionally a main wall
4. Migrates all problems from the three sectors to the correct sector/wall combination
5. Migrates images from old sectors to the main sector
6. Deletes the old sectors

Usage:
    python manage.py fix_lidomorna_sectors
    python manage.py fix_lidomorna_sectors --dry-run
    python manage.py fix_lidomorna_sectors --main-wall-name "Hlavní"
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction
from boulders.models import Sector, Wall, BoulderImage
from decimal import Decimal


class Command(BaseCommand):
    help = "Fix Lidomorna sectors structure - merge into one sector with walls"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without actually modifying data",
        )
        parser.add_argument(
            "--user",
            type=str,
            default="admin",
            help="Username to assign as creator (default: admin)",
        )
        parser.add_argument(
            "--main-wall-name",
            type=str,
            default=None,
            help="Name for the main wall (default: None, problems stay without wall). Use 'Hlavní' for Czech.",
        )
        parser.add_argument(
            "--sector-name",
            type=str,
            default="Lidomorna",
            help="Base sector name to use (default: Lidomorna)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        username = options["user"]
        main_wall_name = options["main_wall_name"]
        base_sector_name = options["sector_name"]

        # Normalize the base sector name for searching (case-insensitive)
        base_name_lower = base_sector_name.lower()

        # Find all sectors that match the pattern
        all_sectors = Sector.objects.all().exclude(area__is_secret=True)
        matching_sectors = []

        for sector in all_sectors:
            sector_name_lower = sector.name.lower()
            # Match exact "lidomorna" or "lidomorna vlevo" or "lidomorna vpravo"
            if (
                sector_name_lower == base_name_lower
                or sector_name_lower == f"{base_name_lower} vlevo"
                or sector_name_lower == f"{base_name_lower} vpravo"
            ):
                matching_sectors.append(sector)

        if not matching_sectors:
            self.stdout.write(
                self.style.WARNING(
                    f"No sectors found matching '{base_sector_name}', '{base_sector_name} vlevo', or '{base_sector_name} vpravo'"
                )
            )
            return

        # Group by area to ensure they're all in the same area
        areas = set(sector.area for sector in matching_sectors)
        if len(areas) > 1:
            self.stdout.write(
                self.style.ERROR(
                    f"ERROR: Found matching sectors in multiple areas: {[area.name for area in areas]}"
                )
            )
            self.stdout.write(
                "Please ensure all Lidomorna sectors are in the same area before running this command."
            )
            return

        area = list(areas)[0]
        self.stdout.write(
            self.style.SUCCESS(
                f"Found {len(matching_sectors)} matching sector(s) in area: {area.name}"
            )
        )

        # Identify which sector is which
        main_sector = None
        vlevo_sector = None
        vpravo_sector = None

        for sector in matching_sectors:
            sector_name_lower = sector.name.lower()
            if sector_name_lower == base_name_lower:
                main_sector = sector
            elif sector_name_lower == f"{base_name_lower} vlevo":
                vlevo_sector = sector
            elif sector_name_lower == f"{base_name_lower} vpravo":
                vpravo_sector = sector

        # Display what we found
        self.stdout.write("\nSectors found:")
        if main_sector:
            self.stdout.write(
                f"  - Main: '{main_sector.name}' ({main_sector.problems.count()} problems)"
            )
        if vlevo_sector:
            self.stdout.write(
                f"  - Vlevo: '{vlevo_sector.name}' ({vlevo_sector.problems.count()} problems)"
            )
        if vpravo_sector:
            self.stdout.write(
                f"  - Vpravo: '{vpravo_sector.name}' ({vpravo_sector.problems.count()} problems)"
            )

        # Determine the target main sector
        # Prefer existing main sector, or use the one with most problems, or create new
        target_main_sector = main_sector
        if not target_main_sector:
            # Use the sector with most problems as the main one
            target_main_sector = max(matching_sectors, key=lambda s: s.problems.count())
            self.stdout.write(
                self.style.WARNING(
                    f"No exact '{base_sector_name}' sector found. Using '{target_main_sector.name}' as main."
                )
            )

        # Calculate average coordinates from all sectors
        total_lat = Decimal("0")
        total_lon = Decimal("0")
        count = 0
        for sector in matching_sectors:
            if sector.latitude and sector.longitude:
                total_lat += sector.latitude
                total_lon += sector.longitude
                count += 1

        avg_lat = total_lat / count if count > 0 else target_main_sector.latitude
        avg_lon = total_lon / count if count > 0 else target_main_sector.longitude

        if dry_run:
            self.stdout.write("\n" + "=" * 60)
            self.stdout.write(self.style.WARNING("DRY RUN - No data will be modified"))
            self.stdout.write("=" * 60)
            self.stdout.write("\nWould perform the following actions:")
            self.stdout.write(
                f"1. Use/rename sector '{target_main_sector.name}' to '{base_sector_name}'"
            )
            self.stdout.write(f"2. Create wall 'vlevo' in sector '{base_sector_name}'")
            self.stdout.write(f"3. Create wall 'vpravo' in sector '{base_sector_name}'")
            if main_wall_name:
                self.stdout.write(
                    f"4. Create wall '{main_wall_name}' in sector '{base_sector_name}'"
                )
            if vlevo_sector:
                self.stdout.write(
                    f"5. Move {vlevo_sector.problems.count()} problems from '{vlevo_sector.name}' to '{base_sector_name}' wall 'vlevo'"
                )
            if vpravo_sector:
                self.stdout.write(
                    f"6. Move {vpravo_sector.problems.count()} problems from '{vpravo_sector.name}' to '{base_sector_name}' wall 'vpravo'"
                )
            if main_sector and main_sector.id != target_main_sector.id:
                self.stdout.write(
                    f"7. Move {main_sector.problems.count()} problems from '{main_sector.name}' to '{base_sector_name}'"
                )
            self.stdout.write("\nRun without --dry-run to perform these changes.")
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

        stats = {
            "problems_moved": 0,
            "images_moved": 0,
            "walls_created": 0,
            "sectors_deleted": 0,
        }

        with transaction.atomic():
            # Step 1: Ensure the main sector has the correct name
            if target_main_sector.name != base_sector_name:
                old_name = target_main_sector.name
                target_main_sector.name = base_sector_name
                target_main_sector.latitude = avg_lat
                target_main_sector.longitude = avg_lon
                target_main_sector.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Renamed sector '{old_name}' to '{base_sector_name}'"
                    )
                )

            # Step 2: Create walls
            vlevo_wall = None
            vpravo_wall = None
            main_wall = None

            # Create vlevo wall
            if vlevo_sector:
                vlevo_wall, created = Wall.objects.get_or_create(
                    sector=target_main_sector,
                    name="vlevo",
                    defaults={
                        "description": f"Left wall of {base_sector_name}",
                        "created_by": user,
                    },
                )
                if created:
                    stats["walls_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created wall 'vlevo' in '{base_sector_name}'"
                        )
                    )

            # Create vpravo wall
            if vpravo_sector:
                vpravo_wall, created = Wall.objects.get_or_create(
                    sector=target_main_sector,
                    name="vpravo",
                    defaults={
                        "description": f"Right wall of {base_sector_name}",
                        "created_by": user,
                    },
                )
                if created:
                    stats["walls_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created wall 'vpravo' in '{base_sector_name}'"
                        )
                    )

            # Create main wall if requested
            if main_wall_name:
                main_wall, created = Wall.objects.get_or_create(
                    sector=target_main_sector,
                    name=main_wall_name,
                    defaults={
                        "description": f"Main wall of {base_sector_name}",
                        "created_by": user,
                    },
                )
                if created:
                    stats["walls_created"] += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created wall '{main_wall_name}' in '{base_sector_name}'"
                        )
                    )

            # Step 3: Migrate problems from vlevo sector
            if vlevo_sector and vlevo_wall:
                problems = vlevo_sector.problems.all()
                for problem in problems:
                    problem.sector = target_main_sector
                    problem.wall = vlevo_wall
                    problem.save()
                    stats["problems_moved"] += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Moved {problems.count()} problems from '{vlevo_sector.name}' to '{base_sector_name}' wall 'vlevo'"
                    )
                )

            # Step 4: Migrate problems from vpravo sector
            if vpravo_sector and vpravo_wall:
                problems = vpravo_sector.problems.all()
                for problem in problems:
                    problem.sector = target_main_sector
                    problem.wall = vpravo_wall
                    problem.save()
                    stats["problems_moved"] += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Moved {problems.count()} problems from '{vpravo_sector.name}' to '{base_sector_name}' wall 'vpravo'"
                    )
                )

            # Step 5: Migrate problems from main sector (if it's different from target)
            if main_sector and main_sector.id != target_main_sector.id:
                problems = main_sector.problems.all()
                for problem in problems:
                    problem.sector = target_main_sector
                    if main_wall:
                        problem.wall = main_wall
                    # If no main wall, problem stays without wall (which is valid)
                    problem.save()
                    stats["problems_moved"] += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Moved {problems.count()} problems from '{main_sector.name}' to '{base_sector_name}'"
                    )
                )

            # Step 6: Migrate images from old sectors to main sector
            sectors_to_delete = []
            if vlevo_sector:
                sectors_to_delete.append(vlevo_sector)
            if vpravo_sector:
                sectors_to_delete.append(vpravo_sector)
            if main_sector and main_sector.id != target_main_sector.id:
                sectors_to_delete.append(main_sector)

            for old_sector in sectors_to_delete:
                images = BoulderImage.objects.filter(sector=old_sector)
                for image in images:
                    image.sector = target_main_sector
                    image.save()
                    stats["images_moved"] += 1
                if images.exists():
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Moved {images.count()} images from '{old_sector.name}' to '{base_sector_name}'"
                        )
                    )

            # Step 7: Delete old sectors (only if they're not the target main sector)
            for old_sector in sectors_to_delete:
                old_sector.delete()
                stats["sectors_deleted"] += 1
                self.stdout.write(
                    self.style.SUCCESS(f"Deleted sector: '{old_sector.name}'")
                )

        # Print summary
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("Migration Summary:"))
        self.stdout.write("=" * 60)
        self.stdout.write(f'Problems moved: {stats["problems_moved"]}')
        self.stdout.write(f'Images moved: {stats["images_moved"]}')
        self.stdout.write(f'Walls created: {stats["walls_created"]}')
        self.stdout.write(f'Sectors deleted: {stats["sectors_deleted"]}')
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✓ Successfully merged sectors into "{base_sector_name}" with walls: vlevo, vpravo'
                + (f", {main_wall_name}" if main_wall_name else "")
            )
        )
