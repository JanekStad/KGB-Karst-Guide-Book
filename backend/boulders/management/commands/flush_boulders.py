"""
Django management command to flush boulder-related data.

This command safely deletes:
- BoulderProblems (and their related ProblemLines)
- Walls
- Crags
- BoulderImages (and their related ProblemLines)

Usage:
    python manage.py flush_boulders
    python manage.py flush_boulders --confirm  # Skip confirmation prompt
"""

from django.core.management.base import BaseCommand, CommandError
from boulders.models import Crag, Wall, BoulderProblem, BoulderImage, ProblemLine


class Command(BaseCommand):
    help = "Flush all boulder-related data (crags, walls, problems, images, lines)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Skip confirmation prompt",
        )

    def handle(self, *args, **options):
        confirm = options["confirm"]

        # Count existing data
        crag_count = Crag.objects.count()
        wall_count = Wall.objects.count()
        problem_count = BoulderProblem.objects.count()
        image_count = BoulderImage.objects.count()
        line_count = ProblemLine.objects.count()

        if crag_count == 0 and problem_count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    "No boulder data to flush. Database is already empty."
                )
            )
            return

        # Show what will be deleted
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("Data to be deleted:")
        self.stdout.write("=" * 50)
        self.stdout.write(f"  Crags: {crag_count}")
        self.stdout.write(f"  Walls: {wall_count}")
        self.stdout.write(f"  Boulder Problems: {problem_count}")
        self.stdout.write(f"  Boulder Images: {image_count}")
        self.stdout.write(f"  Problem Lines: {line_count}")
        self.stdout.write("=" * 50)

        # Confirm deletion
        if not confirm:
            self.stdout.write(
                self.style.WARNING(
                    "\n⚠️  WARNING: This will permanently delete all boulder-related data!"
                )
            )
            response = input("Type 'yes' to confirm: ")
            if response.lower() != "yes":
                self.stdout.write(self.style.ERROR("Operation cancelled."))
                return

        # Delete in correct order (respecting foreign key constraints)
        self.stdout.write("\nDeleting data...")

        # Delete ProblemLines first (they reference images and problems)
        deleted_lines = ProblemLine.objects.all().delete()[0]
        self.stdout.write(
            self.style.SUCCESS(f"  ✓ Deleted {deleted_lines} problem lines")
        )

        # Delete BoulderProblems (they reference crags and walls)
        deleted_problems = BoulderProblem.objects.all().delete()[0]
        self.stdout.write(
            self.style.SUCCESS(f"  ✓ Deleted {deleted_problems} boulder problems")
        )

        # Delete BoulderImages (they reference walls)
        deleted_images = BoulderImage.objects.all().delete()[0]
        self.stdout.write(
            self.style.SUCCESS(f"  ✓ Deleted {deleted_images} boulder images")
        )

        # Delete Walls (they reference crags)
        deleted_walls = Wall.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f"  ✓ Deleted {deleted_walls} walls"))

        # Delete Crags last
        deleted_crags = Crag.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f"  ✓ Deleted {deleted_crags} crags"))

        # Summary
        self.stdout.write("\n" + "=" * 50)
        self.stdout.write(
            self.style.SUCCESS("✅ All boulder data flushed successfully!")
        )
        self.stdout.write("=" * 50)
        self.stdout.write(
            "\nYou can now run a fresh import:\n"
            "  python manage.py scrape_lezec --import --type boulder --location 199 --user admin"
        )
