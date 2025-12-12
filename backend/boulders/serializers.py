from rest_framework import serializers
from .models import City, Area, Sector, Wall, BoulderProblem, BoulderImage, ProblemLine


class BoulderProblemMixin:
    """Mixin for shared methods between BoulderProblem serializers"""

    def get_author_username(self, obj):
        """Return author username if User exists, otherwise return author_name"""
        if obj.author:
            return obj.author.username
        return obj.author_name if obj.author_name else None


class CitySerializer(serializers.ModelSerializer):
    area_count = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = [
            "id",
            "name",
            "description",
            "area_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_area_count(self, obj):
        return obj.area_count


class CityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for city list views"""

    area_count = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = ["id", "name", "area_count"]

    def get_area_count(self, obj):
        return obj.area_count


class ProblemLineSerializer(serializers.ModelSerializer):
    problem_name = serializers.CharField(source="problem.name", read_only=True)
    problem_id = serializers.IntegerField(source="problem.id", read_only=True)
    problem_grade = serializers.CharField(source="problem.grade", read_only=True)

    class Meta:
        model = ProblemLine
        fields = [
            "id",
            "problem",
            "problem_id",
            "problem_name",
            "problem_grade",
            "coordinates",
            "color",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class BoulderImageSerializer(serializers.ModelSerializer):
    problem_lines = ProblemLineSerializer(many=True, read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = BoulderImage
        fields = [
            "id",
            "image",
            "caption",
            "is_primary",
            "uploaded_at",
            "problem_lines",
        ]
        read_only_fields = ["uploaded_at"]

    def get_image(self, obj):
        """Return absolute URL for the image"""
        if not obj.image:
            return None

        request = self.context.get("request")
        try:
            # Get the relative URL from the ImageField
            image_url = obj.image.url if hasattr(obj.image, "url") else str(obj.image)

            # Build absolute URL
            if request:
                return request.build_absolute_uri(image_url)

            # Fallback: construct URL manually if no request context
            from django.conf import settings

            base_url = getattr(settings, "BASE_URL", "http://localhost:8000")
            # Ensure image_url starts with /
            if not image_url.startswith("/"):
                image_url = "/" + image_url
            return f"{base_url}{image_url}"
        except (ValueError, AttributeError):
            # If image field is empty or invalid, return None
            return None


class WallSerializer(serializers.ModelSerializer):
    """Serializer for Wall (sub-sector within Sector)"""

    problem_count = serializers.SerializerMethodField()
    sector_name = serializers.CharField(source="sector.name", read_only=True)
    area_name = serializers.CharField(source="sector.area.name", read_only=True)

    class Meta:
        model = Wall
        fields = [
            "id",
            "sector",
            "sector_name",
            "area_name",
            "name",
            "description",
            "problem_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_problem_count(self, obj):
        return obj.problem_count


class SectorSerializer(serializers.ModelSerializer):
    """Serializer for Sector (within Area)"""

    problem_count = serializers.SerializerMethodField()
    wall_count = serializers.SerializerMethodField()
    area_name = serializers.CharField(source="area.name", read_only=True)

    class Meta:
        model = Sector
        fields = [
            "id",
            "area",
            "area_name",
            "name",
            "description",
            "latitude",
            "longitude",
            "polygon_boundary",
            "is_secret",
            "problem_count",
            "wall_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_problem_count(self, obj):
        return obj.problem_count

    def get_wall_count(self, obj):
        return obj.wall_count


class SectorListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sector list views"""

    problem_count = serializers.SerializerMethodField()
    area_name = serializers.CharField(source="area.name", read_only=True)

    class Meta:
        model = Sector
        fields = [
            "id",
            "area",
            "area_name",
            "name",
            "latitude",
            "longitude",
            "polygon_boundary",
            "is_secret",
            "problem_count",
        ]

    def get_problem_count(self, obj):
        return obj.problem_count


class AreaSerializer(serializers.ModelSerializer):
    """Serializer for Area (large geographic region)"""

    problem_count = serializers.SerializerMethodField()
    sector_count = serializers.SerializerMethodField()
    city_detail = CityListSerializer(source="city", read_only=True)
    sectors = serializers.SerializerMethodField()

    class Meta:
        model = Area
        fields = [
            "id",
            "city",
            "city_detail",
            "name",
            "description",
            "is_secret",
            "problem_count",
            "sector_count",
            "sectors",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_problem_count(self, obj):
        return obj.problem_count

    def get_sector_count(self, obj):
        return obj.sector_count

    def get_sectors(self, obj):
        """Filter out secret sectors"""
        # Only include sectors if the area itself is not secret
        if obj.is_secret:
            return []
        # Filter out secret sectors
        sectors = obj.sectors.filter(is_secret=False)
        return SectorListSerializer(sectors, many=True).data


class AreaListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for area list views"""

    problem_count = serializers.SerializerMethodField()
    city_name = serializers.CharField(
        source="city.name", read_only=True, allow_null=True
    )

    class Meta:
        model = Area
        fields = [
            "id",
            "city",
            "city_name",
            "name",
            "is_secret",
            "problem_count",
        ]

    def get_problem_count(self, obj):
        return obj.problem_count


class BoulderProblemSerializer(BoulderProblemMixin, serializers.ModelSerializer):
    area_detail = AreaListSerializer(source="area", read_only=True)
    sector_detail = SectorListSerializer(source="sector", read_only=True)
    wall_detail = WallSerializer(source="wall", read_only=True)
    images = serializers.SerializerMethodField()
    tick_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    suggested_grade = serializers.SerializerMethodField()
    suggested_grade_votes = serializers.SerializerMethodField()
    author_username = serializers.SerializerMethodField()

    def get_images(self, obj):
        """Get images associated with this problem through ProblemLine or sector"""
        from .models import BoulderImage

        # Get images from two sources:
        # 1. Images that have ProblemLines for this problem (priority - these are explicitly linked)
        # 2. Images from the sector (if problem has a sector) - but only if no ProblemLine images exist
        #    OR if we want to show all sector images regardless

        # Images with ProblemLines for this problem (explicitly linked)
        # Don't use .distinct() here - we'll apply it after combining querysets
        images_with_lines = BoulderImage.objects.filter(problem_lines__problem=obj)

        # Images from the sector (if problem has a sector)
        # Only include sector images if they don't already have ProblemLines for this problem
        # This prevents duplicates and ensures ProblemLine-linked images take priority
        if obj.sector:
            # Get IDs from images_with_lines as a list to avoid queryset combination issues
            images_with_lines_ids = list(images_with_lines.values_list("id", flat=True))
            sector_images = obj.sector.images.exclude(id__in=images_with_lines_ids)
            # Combine both querysets - now both are regular querysets, so this will work
            image_queryset = (images_with_lines | sector_images).distinct()
        else:
            image_queryset = images_with_lines.distinct()

        # Prefetch related data for performance
        image_queryset = image_queryset.prefetch_related("problem_lines__problem")

        # Build the response data
        image_data = []
        seen_image_ids = set()

        for image in image_queryset:
            # Avoid duplicates
            if image.id in seen_image_ids:
                continue
            seen_image_ids.add(image.id)

            # Get ALL problem_lines for this image (not just for the current problem)
            # This allows users to see all problems on the image for context
            all_problem_lines = image.problem_lines.all()

            # Serialize the image with request context for absolute URLs
            serializer = BoulderImageSerializer(image, context=self.context)
            image_dict = serializer.data
            # Include ALL problem lines on this image
            image_dict["problem_lines"] = ProblemLineSerializer(
                all_problem_lines, many=True, context=self.context
            ).data
            image_data.append(image_dict)

        return image_data

    class Meta:
        model = BoulderProblem
        fields = [
            "id",
            "area",
            "area_detail",
            "sector",
            "sector_detail",
            "wall",
            "wall_detail",
            "name",
            "grade",
            "suggested_grade",
            "suggested_grade_votes",
            "description",
            "rating",
            "average_rating",
            "author",
            "author_username",
            "author_name",
            "images",
            "external_links",
            "video_links",
            "tick_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_tick_count(self, obj):
        # Use annotated count if available (from queryset optimization), otherwise fallback
        if hasattr(obj, "tick_count_annotated"):
            return obj.tick_count_annotated
        return obj.ticks.count()

    def get_suggested_grade(self, obj):
        """Get the most common suggested grade from ticks (grade with most votes)"""
        from django.db.models import Count
        from lists.models import Tick

        grade_counts = (
            Tick.objects.filter(problem=obj)
            .exclude(suggested_grade__isnull=True)
            .exclude(suggested_grade="")
            .values("suggested_grade")
            .annotate(count=Count("suggested_grade"))
            .order_by("-count")
        )

        if grade_counts:
            return grade_counts[0]["suggested_grade"]
        return None

    def get_suggested_grade_votes(self, obj):
        """Get the number of votes for the most common suggested grade"""
        from lists.models import Tick

        suggested_grade = self.get_suggested_grade(obj)
        if suggested_grade:
            return Tick.objects.filter(
                problem=obj, suggested_grade=suggested_grade
            ).count()
        return 0

    def get_average_rating(self, obj):
        """Calculate average rating from all tick ratings"""
        # Use annotated average if available (from queryset optimization), otherwise calculate
        if (
            hasattr(obj, "avg_rating_annotated")
            and obj.avg_rating_annotated is not None
        ):
            return float(obj.avg_rating_annotated)

        # Fallback: calculate from ticks if not annotated
        from django.db.models import Avg
        from lists.models import Tick

        avg_rating = Tick.objects.filter(problem=obj, rating__isnull=False).aggregate(
            avg=Avg("rating")
        )["avg"]

        # Return the average rating from ticks if available, otherwise use problem.rating
        if avg_rating is not None:
            return float(avg_rating)
        # Fallback to problem.rating if no tick ratings exist
        return float(obj.rating) if obj.rating else None


class BoulderProblemListSerializer(BoulderProblemMixin, serializers.ModelSerializer):
    """Lightweight serializer for problem list views"""

    area_name = serializers.CharField(source="area.name", read_only=True)
    sector_name = serializers.CharField(
        source="sector.name", read_only=True, allow_null=True
    )
    wall_name = serializers.CharField(
        source="wall.name", read_only=True, allow_null=True
    )
    tick_count = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    recommended_percentage = serializers.SerializerMethodField()
    media_count = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()
    has_video = serializers.SerializerMethodField()
    has_external_links = serializers.SerializerMethodField()
    description_preview = serializers.SerializerMethodField()
    author_username = serializers.SerializerMethodField()

    class Meta:
        model = BoulderProblem
        fields = [
            "id",
            "area",
            "area_name",
            "sector",
            "sector_name",
            "wall",
            "wall_name",
            "name",
            "grade",
            "rating",
            "average_rating",
            "author",
            "author_username",
            "author_name",
            "created_by",
            "tick_count",
            "recommended_percentage",
            "media_count",
            "primary_image",
            "has_video",
            "has_external_links",
            "description_preview",
        ]

    def get_tick_count(self, obj):
        # Use annotated count if available (from queryset optimization), otherwise fallback
        if hasattr(obj, "tick_count_annotated"):
            return obj.tick_count_annotated
        return obj.ticks.count()

    def get_average_rating(self, obj):
        """Calculate average rating from all tick ratings"""
        # Use annotated average if available (from queryset optimization), otherwise calculate
        if (
            hasattr(obj, "avg_rating_annotated")
            and obj.avg_rating_annotated is not None
        ):
            return float(obj.avg_rating_annotated)

        # Fallback: calculate from ticks if not annotated
        from django.db.models import Avg
        from lists.models import Tick

        avg_rating = Tick.objects.filter(problem=obj, rating__isnull=False).aggregate(
            avg=Avg("rating")
        )["avg"]

        # Return the average rating from ticks if available, otherwise use problem.rating
        if avg_rating is not None:
            return float(avg_rating)
        # Fallback to problem.rating if no tick ratings exist
        return float(obj.rating) if obj.rating else None

    def get_recommended_percentage(self, obj):
        """Calculate percentage of ticks that recommended this problem (rating >= 4.0)"""
        from lists.models import Tick

        total_ticks = obj.ticks.count()
        if total_ticks == 0:
            return 0

        recommended_ticks = Tick.objects.filter(problem=obj, rating__gte=4.0).count()

        return round((recommended_ticks / total_ticks) * 100)

    def get_media_count(self, obj):
        """Count total media items (images + videos)"""
        from .models import BoulderImage

        # Count images associated with this problem through ProblemLines
        image_count = (
            BoulderImage.objects.filter(problem_lines__problem=obj).distinct().count()
        )
        # Count videos
        video_count = len(obj.video_links) if obj.video_links else 0
        return image_count + video_count

    def get_primary_image(self, obj):
        """Get primary image for this problem through ProblemLine"""
        from .models import BoulderImage

        request = self.context.get("request")

        # Try to get a primary image from the sector first
        if obj.sector:
            primary = obj.sector.images.filter(is_primary=True).first()
            if primary and primary.image:
                if request:
                    return request.build_absolute_uri(primary.image.url)
                # Fallback
                from django.conf import settings

                base_url = getattr(settings, "BASE_URL", "http://localhost:8000")
                return f"{base_url}{primary.image.url}"

        # Otherwise, get the first image associated with this problem
        image = BoulderImage.objects.filter(problem_lines__problem=obj).first()
        if image and image.image:
            if request:
                return request.build_absolute_uri(image.image.url)
            # Fallback
            from django.conf import settings

            base_url = getattr(settings, "BASE_URL", "http://localhost:8000")
            return f"{base_url}{image.image.url}"
        return None

    def get_has_video(self, obj):
        """Check if problem has video links"""
        return bool(obj.video_links and len(obj.video_links) > 0)

    def get_has_external_links(self, obj):
        """Check if problem has external links"""
        return bool(obj.external_links and len(obj.external_links) > 0)

    def get_description_preview(self, obj):
        """Get truncated description preview (first 100 characters)"""
        if not obj.description:
            return None
        preview = obj.description.strip()
        if len(preview) > 100:
            return preview[:100] + "..."
        return preview
