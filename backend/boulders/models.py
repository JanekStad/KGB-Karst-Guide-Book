from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User
from .utils import normalize_problem_name


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
    is_secret = models.BooleanField(
        default=False,
        help_text="If True, this crag is hidden from public view (secret/illegal climbing spots)",
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
    name_normalized = models.CharField(
        max_length=200,
        db_index=True,
        help_text="Normalized version of name (lowercase, no diacritics) for safe lookups",
    )
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
    rating = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Star rating from 1 to 5 (e.g., 1.0, 2.5, 5.0)",
        validators=[MinValueValidator(1.0), MaxValueValidator(5.0)],
    )
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_problems",
        help_text="Author/establisher of this boulder problem",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_problems"
    )

    class Meta:
        ordering = ["crag", "wall", "name"]
        unique_together = [["crag", "name"]]
        indexes = [
            models.Index(fields=["crag", "name_normalized"]),
        ]

    def save(self, *args, **kwargs):
        """Auto-populate name_normalized before saving"""
        if self.name:
            self.name_normalized = normalize_problem_name(self.name)
        super().save(*args, **kwargs)

    @classmethod
    def find_by_normalized_name(cls, name, crag=None):
        """
        Find a problem by normalized name (case-insensitive, diacritic-insensitive).

        Args:
            name (str): Problem name (will be normalized)
            crag (Crag, optional): Optional crag to filter by

        Returns:
            QuerySet: QuerySet of matching problems
        """
        normalized = normalize_problem_name(name)
        queryset = cls.objects.filter(name_normalized=normalized)
        if crag:
            queryset = queryset.filter(crag=crag)
        return queryset

    def __str__(self):
        wall_str = f" ({self.wall.name})" if self.wall else ""
        return f"{self.crag.name}{wall_str} - {self.name} ({self.grade})"


class BoulderImage(models.Model):
    """Images associated with walls or shared across multiple problems via ProblemLine"""

    # Images can be associated with a wall (optional)
    # Problems are linked to images through ProblemLine model (many-to-many relationship)
    wall = models.ForeignKey(
        Wall,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
        help_text="Optional: Wall this image belongs to. Images can also be shared across problems via ProblemLine.",
    )
    image = models.ImageField(upload_to="boulder_images/")
    caption = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Primary image for a wall (if wall is specified). This flag only affects wall-level image ordering and display. For images linked to problems via ProblemLine, this flag is ignored.",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        # Order by is_primary only for wall images, but this doesn't affect problem-linked images
        ordering = ["-is_primary", "uploaded_at"]

    def __str__(self):
        if self.wall:
            return f"Image for {self.wall}"
        problem_count = self.problem_lines.count()
        if problem_count > 0:
            return f"Shared image ({problem_count} problem{'s' if problem_count > 1 else ''})"
        return f"Image #{self.id}"

    def clean(self):
        # Validation is optional - images can exist without wall if they have ProblemLines
        # We can't validate ProblemLines here since it's a reverse relation
        pass


class ProblemLine(models.Model):
    """Stores line coordinates for a problem on an image"""

    image = models.ForeignKey(
        BoulderImage,
        on_delete=models.CASCADE,
        related_name="problem_lines",
        help_text="Image containing this problem line",
    )
    problem = models.ForeignKey(
        BoulderProblem,
        on_delete=models.CASCADE,
        related_name="image_lines",
        help_text="Problem this line represents",
    )
    # Line coordinates stored as array of points: [{"x": 0.5, "y": 0.3}, ...]
    # Coordinates are normalized (0-1) relative to image dimensions
    coordinates = models.JSONField(
        default=list,
        help_text="Array of coordinate points. Each point has 'x' and 'y' (0-1 normalized). Example: [{'x': 0.2, 'y': 0.3}, {'x': 0.8, 'y': 0.7}]",
    )
    color = models.CharField(
        max_length=7,
        default="#FF0000",
        help_text="Hex color code for the line (e.g., #FF0000)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ["created_at"]
        unique_together = [["image", "problem"]]

    def __str__(self):
        return f"Line for {self.problem.name} on image {self.image.id}"
