from rest_framework import serializers
from django.contrib.auth.models import User
from .models import City, Crag, Wall, BoulderProblem, BoulderImage, ProblemLine


class CitySerializer(serializers.ModelSerializer):
    crag_count = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = [
            "id",
            "name",
            "description",
            "crag_count",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_crag_count(self, obj):
        return obj.crag_count


class CityListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for city list views"""

    crag_count = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = ["id", "name", "crag_count"]

    def get_crag_count(self, obj):
        return obj.crag_count


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
        except (ValueError, AttributeError) as e:
            # If image field is empty or invalid, return None
            return None


class WallSerializer(serializers.ModelSerializer):
    problem_count = serializers.SerializerMethodField()

    class Meta:
        model = Wall
        fields = [
            "id",
            "crag",
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


class CragSerializer(serializers.ModelSerializer):
    problem_count = serializers.SerializerMethodField()
    city_detail = CityListSerializer(source="city", read_only=True)
    walls = WallSerializer(many=True, read_only=True)

    class Meta:
        model = Crag
        fields = [
            "id",
            "city",
            "city_detail",
            "name",
            "description",
            "latitude",
            "longitude",
            "problem_count",
            "walls",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = ["created_at", "updated_at", "created_by"]

    def get_problem_count(self, obj):
        return obj.problem_count


class CragListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for crag list views"""

    problem_count = serializers.SerializerMethodField()
    city_name = serializers.CharField(
        source="city.name", read_only=True, allow_null=True
    )

    class Meta:
        model = Crag
        fields = [
            "id",
            "city",
            "city_name",
            "name",
            "latitude",
            "longitude",
            "problem_count",
        ]

    def get_problem_count(self, obj):
        return obj.problem_count


class BoulderProblemSerializer(serializers.ModelSerializer):
    crag_detail = CragListSerializer(source="crag", read_only=True)
    wall_detail = WallSerializer(source="wall", read_only=True)
    images = serializers.SerializerMethodField()
    tick_count = serializers.SerializerMethodField()

    def get_images(self, obj):
        """Get images associated with this problem through ProblemLine or wall"""
        from .models import BoulderImage

        # Get images from two sources:
        # 1. Images that have ProblemLines for this problem (priority - these are explicitly linked)
        # 2. Images from the wall (if problem has a wall) - but only if no ProblemLine images exist
        #    OR if we want to show all wall images regardless

        # Images with ProblemLines for this problem (explicitly linked)
        # Don't use .distinct() here - we'll apply it after combining querysets
        images_with_lines = BoulderImage.objects.filter(problem_lines__problem=obj)

        # Images from the wall (if problem has a wall)
        # Only include wall images if they don't already have ProblemLines for this problem
        # This prevents duplicates and ensures ProblemLine-linked images take priority
        if obj.wall:
            # Get IDs from images_with_lines as a list to avoid queryset combination issues
            images_with_lines_ids = list(images_with_lines.values_list("id", flat=True))
            wall_images = obj.wall.images.exclude(id__in=images_with_lines_ids)
            # Combine both querysets - now both are regular querysets, so this will work
            image_queryset = (images_with_lines | wall_images).distinct()
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
            "crag",
            "crag_detail",
            "wall",
            "wall_detail",
            "name",
            "grade",
            "description",
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
        return obj.ticks.count()


class BoulderProblemListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for problem list views"""

    crag_name = serializers.CharField(source="crag.name", read_only=True)
    wall_name = serializers.CharField(
        source="wall.name", read_only=True, allow_null=True
    )
    tick_count = serializers.SerializerMethodField()
    primary_image = serializers.SerializerMethodField()

    class Meta:
        model = BoulderProblem
        fields = [
            "id",
            "crag",
            "crag_name",
            "wall",
            "wall_name",
            "name",
            "grade",
            "tick_count",
            "primary_image",
        ]

    def get_tick_count(self, obj):
        return obj.ticks.count()

    def get_primary_image(self, obj):
        """Get primary image for this problem through ProblemLine"""
        from .models import BoulderImage

        request = self.context.get("request")

        # Try to get a primary image from the wall first
        if obj.wall:
            primary = obj.wall.images.filter(is_primary=True).first()
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
