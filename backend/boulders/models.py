from django.db import models
from django.contrib.auth.models import User


class City(models.Model):
    """Represents a city/area where climbing crags are located"""

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_cities"
    )

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Cities"

    def __str__(self):
        return self.name

    @property
    def crag_count(self):
        return self.crags.count()


class Crag(models.Model):
    """Represents a climbing crag/area (massive wall)"""

    city = models.ForeignKey(
        City,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="crags",
        help_text="City/area where this crag is located",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text="Latitude coordinate for map positioning",
    )
    longitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        help_text="Longitude coordinate for map positioning",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_crags"
    )

    class Meta:
        ordering = ["city", "name"]

    def __str__(self):
        return self.name

    @property
    def problem_count(self):
        return self.problems.count()


class Wall(models.Model):
    """Optional: Represents a wall/sector within a crag for organization"""

    crag = models.ForeignKey(Crag, on_delete=models.CASCADE, related_name="walls")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_walls"
    )

    class Meta:
        ordering = ["crag", "name"]
        unique_together = [["crag", "name"]]

    def __str__(self):
        return f"{self.crag.name} - {self.name}"

    @property
    def problem_count(self):
        return self.problems.count()


class BoulderProblem(models.Model):
    """Represents a specific climbing problem on a crag/wall"""

    GRADE_CHOICES = [
        ("3", "3"),
        ("3+", "3+"),
        ("4", "4"),
        ("4+", "4+"),
        ("5", "5"),
        ("5+", "5+"),
        ("6A", "6A"),
        ("6A+", "6A+"),
        ("6B", "6B"),
        ("6B+", "6B+"),
        ("6C", "6C"),
        ("6C+", "6C+"),
        ("7A", "7A"),
        ("7A+", "7A+"),
        ("7B", "7B"),
        ("7B+", "7B+"),
        ("7C", "7C"),
        ("7C+", "7C+"),
        ("8A", "8A"),
        ("8A+", "8A+"),
        ("8B", "8B"),
        ("8B+", "8B+"),
        ("8C", "8C"),
        ("8C+", "8C+"),
        ("9A", "9A"),
        ("9A+", "9A+"),
    ]

    crag = models.ForeignKey(Crag, on_delete=models.CASCADE, related_name="problems")
    wall = models.ForeignKey(
        Wall,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="problems",
        help_text="Optional: Wall/sector within the crag",
    )
    name = models.CharField(max_length=200)
    grade = models.CharField(max_length=10, choices=GRADE_CHOICES)
    description = models.TextField(blank=True)
    external_links = models.JSONField(
        default=list,
        blank=True,
        help_text="List of external links with 'label' and 'url' fields. Example: [{'label': '8a.nu', 'url': 'https://...'}]",
    )
    video_links = models.JSONField(
        default=list,
        blank=True,
        help_text="List of video links (YouTube, Vimeo, etc.) with 'label' and 'url' fields. Example: [{'label': 'Send Video', 'url': 'https://youtube.com/...'}]",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_problems"
    )

    class Meta:
        ordering = ["crag", "wall", "name"]
        unique_together = [["crag", "name"]]

    def __str__(self):
        wall_str = f" ({self.wall.name})" if self.wall else ""
        return f"{self.crag.name}{wall_str} - {self.name} ({self.grade})"


class BoulderImage(models.Model):
    """Images associated with problems or walls"""

    wall = models.ForeignKey(
        Wall, on_delete=models.CASCADE, related_name="images", null=True, blank=True
    )
    problem = models.ForeignKey(
        BoulderProblem,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
    )
    image = models.ImageField(upload_to="boulder_images/")
    caption = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ["-is_primary", "uploaded_at"]

    def __str__(self):
        if self.problem:
            return f"Image for {self.problem}"
        return f"Image for {self.wall}"

    def clean(self):
        from django.core.exceptions import ValidationError

        if not self.wall and not self.problem:
            raise ValidationError("Either wall or problem must be specified")
