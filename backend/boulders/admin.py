from django.contrib import admin
from .models import City, Area, Sector, Wall, BoulderProblem, BoulderImage, ProblemLine


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "area_count", "created_by", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["created_at", "updated_at", "area_count"]

    def area_count(self, obj):
        return obj.area_count

    area_count.short_description = "Areas"  # type: ignore[attr-defined]


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "is_secret", "created_by", "created_at"]
    list_filter = ["city", "is_secret", "created_at"]
    search_fields = ["name", "description", "city__name"]
    readonly_fields = ["created_at", "updated_at", "problem_count", "sector_count"]


@admin.register(Sector)
class SectorAdmin(admin.ModelAdmin):
    list_display = ["name", "area", "latitude", "longitude", "created_by", "created_at", "radius_meters"]
    list_filter = ["area", "created_at"]
    search_fields = ["name", "description", "area__name"]
    readonly_fields = ["created_at", "updated_at", "problem_count", "wall_count"]
    fieldsets = (
        (
            "Basic Information",
            {"fields": ("area", "name", "description")},
        ),
        (
            "Location",
            {
                "fields": ("latitude", "longitude", "polygon_boundary"),
                "description": "Latitude/longitude for marker positioning. Polygon boundary is an array of [lat, lng] pairs defining the sector boundary. Example: [[49.4, 16.7], [49.401, 16.7], [49.401, 16.701], [49.4, 16.701]]",
            },
        ),
        (
            "Metadata",
            {
                "fields": (
                    "created_by",
                    "created_at",
                    "updated_at",
                    "problem_count",
                    "wall_count",
                )
            },
        ),
    )


@admin.register(Wall)
class WallAdmin(admin.ModelAdmin):
    list_display = ["name", "sector", "created_by", "created_at"]
    list_filter = ["sector", "created_at"]
    search_fields = ["name", "description", "sector__name", "sector__area__name"]
    readonly_fields = ["created_at", "updated_at", "problem_count"]


@admin.register(BoulderProblem)
class BoulderProblemAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "area",
        "sector",
        "wall",
        "grade",
        "created_by",
        "created_at",
    ]
    list_filter = ["area", "sector", "wall", "grade", "created_at"]
    search_fields = ["name", "area__name", "sector__name", "wall__name", "description"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (
            "Basic Information",
            {"fields": ("name", "area", "sector", "wall", "grade", "description")},
        ),
        (
            "Media & Links",
            {
                "fields": ("external_links", "video_links"),
                "description": 'External links: [{"label": "8a.nu", "url": "https://..."}]. Video links: [{"label": "Send Video", "url": "https://youtube.com/..."}]',
            },
        ),
        ("Metadata", {"fields": ("created_by", "created_at", "updated_at")}),
    )


@admin.register(BoulderImage)
class BoulderImageAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "sector",
        "problem_count",
        "is_primary",
        "uploaded_by",
        "uploaded_at",
    ]
    list_filter = ["is_primary", "uploaded_at", "sector"]
    search_fields = ["caption", "sector__name"]
    readonly_fields = ["uploaded_at", "problem_count"]

    def problem_count(self, obj):
        """Show how many problems are linked to this image via ProblemLine"""
        count = obj.problem_lines.count()
        return f"{count} problem{'s' if count != 1 else ''}"

    problem_count.short_description = "Problems"  # type: ignore[attr-defined]


@admin.register(ProblemLine)
class ProblemLineAdmin(admin.ModelAdmin):
    list_display = ["id", "problem", "image", "color", "created_by", "created_at"]
    list_filter = ["color", "created_at"]
    search_fields = ["problem__name", "image__caption"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (
            "Line Information",
            {
                "fields": ("image", "problem", "color"),
                "description": "Select the image and problem this line represents. Color should be a hex code (e.g., #FF0000).",
            },
        ),
        (
            "Coordinates",
            {
                "fields": ("coordinates",),
                "description": 'Coordinates are normalized (0-1) relative to image dimensions. Format: [{"x": 0.2, "y": 0.3}, {"x": 0.8, "y": 0.7}]. Each point represents a point along the line path.',
            },
        ),
        ("Metadata", {"fields": ("created_by", "created_at", "updated_at")}),
    )
