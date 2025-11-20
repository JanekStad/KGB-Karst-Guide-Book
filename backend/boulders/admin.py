from django.contrib import admin
from .models import City, Crag, Wall, BoulderProblem, BoulderImage, ProblemLine


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ["name", "crag_count", "created_by", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["name", "description"]
    readonly_fields = ["created_at", "updated_at", "crag_count"]

    def crag_count(self, obj):
        return obj.crag_count

    crag_count.short_description = "Crags"


@admin.register(Crag)
class CragAdmin(admin.ModelAdmin):
    list_display = ["name", "city", "latitude", "longitude", "created_by", "created_at"]
    list_filter = ["city", "created_at"]
    search_fields = ["name", "description", "city__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Wall)
class WallAdmin(admin.ModelAdmin):
    list_display = ["name", "crag", "created_by", "created_at"]
    list_filter = ["crag", "created_at"]
    search_fields = ["name", "description", "crag__name"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(BoulderProblem)
class BoulderProblemAdmin(admin.ModelAdmin):
    list_display = ["name", "crag", "wall", "grade", "created_by", "created_at"]
    list_filter = ["crag", "wall", "grade", "created_at"]
    search_fields = ["name", "crag__name", "wall__name", "description"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (
            "Basic Information",
            {"fields": ("name", "crag", "wall", "grade", "description")},
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
        "wall",
        "problem_count",
        "is_primary",
        "uploaded_by",
        "uploaded_at",
    ]
    list_filter = ["is_primary", "uploaded_at", "wall"]
    search_fields = ["caption", "wall__name"]
    readonly_fields = ["uploaded_at", "problem_count"]

    def problem_count(self, obj):
        """Show how many problems are linked to this image via ProblemLine"""
        count = obj.problem_lines.count()
        return f"{count} problem{'s' if count != 1 else ''}"

    problem_count.short_description = "Problems"


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
