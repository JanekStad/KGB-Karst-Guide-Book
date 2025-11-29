from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from .utils import normalize_problem_name


class City(models.Model):
    """Represents a city/area where climbing areas are located"""

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
    def area_count(self):
        """Count of areas in this city"""
        return self.areas.count()

    @property
    def crag_count(self):
        """Backward compatibility: alias for area_count"""
        return self.area_count


class Area(models.Model):
    """Represents a large geographic climbing area (e.g., Sloup, Holstejn, Rudice)"""

    city = models.ForeignKey(
        City,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="areas",
        help_text="City/area where this climbing area is located",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    is_secret = models.BooleanField(
        default=False,
        help_text="If True, this area is hidden from public view (secret/illegal climbing spots)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_areas"
    )

    class Meta:
        ordering = ["city", "name"]
        verbose_name_plural = "Areas"

    def __str__(self):
        return self.name

    @property
    def problem_count(self):
        """Count of problems in this area"""
        return self.problems.count()

    @property
    def sector_count(self):
        """Count of sectors in this area"""
        return self.sectors.count()


class Sector(models.Model):
    """Represents a sector within an area (e.g., Lidomorna, Vanousovy diry, Stara rasovna)"""

    area = models.ForeignKey(
        Area,
        on_delete=models.CASCADE,
        related_name="sectors",
        help_text="Area this sector belongs to",
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
    polygon_boundary = models.JSONField(
        null=True,
        blank=True,
        help_text="Array of [lat, lng] coordinate pairs defining the sector boundary polygon. Example: [[49.4, 16.7], [49.401, 16.7], [49.401, 16.701], [49.4, 16.701]]",
    )
    is_secret = models.BooleanField(
        default=False,
        help_text="If True, this sector is hidden from public view (secret/illegal climbing spots)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_sectors"
    )

    class Meta:
        ordering = ["area", "name"]
        unique_together = [["area", "name"]]
        verbose_name_plural = "Sectors"

    def __str__(self):
        return f"{self.area.name} - {self.name}"

    @property
    def problem_count(self):
        """Count of problems in this sector"""
        return self.problems.count()

    @property
    def wall_count(self):
        """Count of walls in this sector"""
        return self.walls.count()


class Wall(models.Model):
    """Represents a sub-sector/wall within a sector (e.g., Vlevo, Vpravo, Central)"""

    sector = models.ForeignKey(
        Sector,
        on_delete=models.CASCADE,
        related_name="walls",
        help_text="Sector this wall belongs to",
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_walls"
    )

    class Meta:
        ordering = ["sector", "name"]
        unique_together = [["sector", "name"]]
        verbose_name_plural = "Walls"

    def __str__(self):
        return f"{self.sector.area.name} - {self.sector.name} - {self.name}"

    @property
    def problem_count(self):
        """Count of problems on this wall"""
        return self.problems.count()


class BoulderProblem(models.Model):
    """Represents a specific climbing problem on an area/sector/wall"""

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

    area = models.ForeignKey(
        Area,
        on_delete=models.CASCADE,
        related_name="problems",
        help_text="Area this problem belongs to",
    )
    sector = models.ForeignKey(
        Sector,
        on_delete=models.CASCADE,
        related_name="problems",
        null=True,
        blank=True,
        help_text="Optional: Sector this problem belongs to. Required if wall is not specified.",
    )
    wall = models.ForeignKey(
        Wall,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="problems",
        help_text="Optional: Wall/sub-sector this problem belongs to. If specified, sector must match wall.sector.",
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
        help_text="Author/establisher of this boulder problem (Django User if exists)",
    )
    author_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Author name as string (used when author is not a Django User)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="created_problems"
    )

    class Meta:
        ordering = ["area", "sector", "wall", "name"]
        unique_together = [["area", "name"]]
        indexes = [
            models.Index(fields=["area", "name_normalized"]),
            models.Index(fields=["sector", "name_normalized"]),
        ]

    def clean(self):
        """Validate relationships"""
        # If wall is specified, ensure sector matches wall.sector
        if self.wall:
            if self.sector and self.sector != self.wall.sector:
                raise ValidationError(
                    {
                        "sector": "Sector must match the wall's sector if wall is specified."
                    }
                )
            # Auto-set sector from wall if not specified
            if not self.sector:
                self.sector = self.wall.sector

        # Ensure sector belongs to area
        if self.sector and self.sector.area != self.area:
            raise ValidationError(
                {"sector": "Sector must belong to the specified area."}
            )

        # Problem must have either sector or wall
        if not self.sector and not self.wall:
            raise ValidationError(
                {
                    "sector": "Problem must have either a sector or a wall specified.",
                    "wall": "Problem must have either a sector or a wall specified.",
                }
            )

    def save(self, *args, **kwargs):
        """Auto-populate name_normalized and validate relationships before saving"""
        # Auto-set sector from wall if wall is specified but sector is not
        if self.wall and not self.sector:
            self.sector = self.wall.sector

        # Auto-populate name_normalized BEFORE validation (always set it)
        if not self.name_normalized and self.name:
            self.name_normalized = normalize_problem_name(self.name)
        elif not self.name_normalized:
            # Fallback: set empty string if name is also empty (shouldn't happen, but be safe)
            self.name_normalized = ""

        # Validate relationships (after name_normalized is set)
        self.full_clean()

        super().save(*args, **kwargs)

    @classmethod
    def find_by_normalized_name(cls, name, area=None, sector=None):
        """
        Find a problem by normalized name (case-insensitive, diacritic-insensitive).

        Args:
            name (str): Problem name (will be normalized)
            area (Area, optional): Optional area to filter by
            sector (Sector, optional): Optional sector to filter by

        Returns:
            QuerySet: QuerySet of matching problems
        """
        normalized = normalize_problem_name(name)
        queryset = cls.objects.filter(name_normalized=normalized)
        if area:
            queryset = queryset.filter(area=area)
        if sector:
            queryset = queryset.filter(sector=sector)
        return queryset

    def __str__(self):
        parts = [self.area.name]
        if self.sector:
            parts.append(self.sector.name)
        if self.wall:
            parts.append(self.wall.name)
        location_str = " - ".join(parts[1:]) if len(parts) > 1 else ""
        location_str = f" ({location_str})" if location_str else ""
        return f"{self.area.name}{location_str} - {self.name} ({self.grade})"


class BoulderImage(models.Model):
    """Images associated with sectors or shared across multiple problems via ProblemLine"""

    # Images can be associated with a sector (optional)
    # Problems are linked to images through ProblemLine model (many-to-many relationship)
    sector = models.ForeignKey(
        Sector,
        on_delete=models.CASCADE,
        related_name="images",
        null=True,
        blank=True,
        help_text="Optional: Sector this image belongs to. Images can also be shared across problems via ProblemLine.",
    )
    image = models.ImageField(upload_to="boulder_images/")
    caption = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(
        default=False,
        help_text="Primary image for a sector (if sector is specified). This flag only affects sector-level image ordering and display. For images linked to problems via ProblemLine, this flag is ignored.",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        # Order by is_primary only for sector images, but this doesn't affect problem-linked images
        ordering = ["-is_primary", "uploaded_at"]

    def __str__(self):
        if self.sector:
            return f"Image for {self.sector}"
        problem_count = self.problem_lines.count()
        if problem_count > 0:
            return f"Shared image ({problem_count} problem{'s' if problem_count > 1 else ''})"
        return f"Image #{self.id}"

    def clean(self):
        # Validation is optional - images can exist without sector if they have ProblemLines
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
