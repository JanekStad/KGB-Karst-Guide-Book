from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Avg, Q, F
from .models import City, Area, Sector, Wall, BoulderProblem, BoulderImage
from .mixins import CreatedByMixin, ListDetailSerializerMixin
from .filters import NormalizedSearchFilter
from .serializers import (
    CitySerializer,
    CityListSerializer,
    AreaSerializer,
    AreaListSerializer,
    SectorSerializer,
    SectorListSerializer,
    WallSerializer,
    BoulderProblemSerializer,
    BoulderProblemListSerializer,
    BoulderImageSerializer,
)


class CityViewSet(CreatedByMixin, ListDetailSerializerMixin, viewsets.ModelViewSet):
    queryset = City.objects.all()
    serializer_class = CitySerializer
    list_serializer_class = CityListSerializer
    filter_backends = [
        DjangoFilterBackend,
        NormalizedSearchFilter,
        filters.OrderingFilter,
    ]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    @action(detail=True, methods=["get"])
    def areas(self, request, pk=None):
        """Get all areas for a specific city"""
        city = self.get_object()
        areas = city.areas.filter(is_secret=False)
        serializer = AreaListSerializer(areas, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def crags(self, request, pk=None):
        """Backward compatibility: alias for areas"""
        return self.areas(request, pk)


class AreaViewSet(CreatedByMixin, ListDetailSerializerMixin, viewsets.ModelViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer
    list_serializer_class = AreaListSerializer
    filter_backends = [
        DjangoFilterBackend,
        NormalizedSearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["city"]
    search_fields = ["name", "description", "city__name"]
    ordering_fields = ["name", "created_at", "city", "problem_count_annotated"]
    ordering = ["-problem_count_annotated", "city", "name"]  # Sort by problem_count descending by default

    def get_queryset(self):
        """Filter out secret areas by default unless user has permission"""
        queryset = super().get_queryset()
        # TODO: Add permission check here when user authentication is implemented
        # For now, always filter out secret areas
        queryset = queryset.filter(is_secret=False).select_related("city")
        # Annotate problem_count_annotated for sorting (excluding problems from secret sectors)
        # Since we already filtered is_secret=False, we just need to check sectors
        # Use different name to avoid conflict with model's @property problem_count
        queryset = queryset.annotate(
            problem_count_annotated=Count(
                "problems",
                filter=Q(problems__sector__isnull=True) | Q(problems__sector__is_secret=False),
                distinct=True
            ),
            # Annotate sector_count (excluding secret sectors)
            sector_count_annotated=Count(
                "sectors",
                filter=Q(sectors__is_secret=False),
                distinct=True
            ),
            # Calculate average coordinates from non-secret sectors for location display
            avg_latitude=Avg(
                "sectors__latitude",
                filter=Q(sectors__is_secret=False) & Q(sectors__latitude__isnull=False)
            ),
            avg_longitude=Avg(
                "sectors__longitude",
                filter=Q(sectors__is_secret=False) & Q(sectors__longitude__isnull=False)
            )
        )
        return queryset

    @action(detail=True, methods=["get"])
    def problems(self, request, pk=None):
        """Get all problems for a specific area (excluding secret sectors)"""
        area = self.get_object()
        # Optimize queryset to avoid N+1 queries
        # Filter out problems from secret sectors
        problems = (
            area.problems.filter(area__is_secret=False)
            .filter(Q(sector__isnull=True) | Q(sector__is_secret=False))
            .select_related("area", "sector", "wall", "author", "created_by")
            .prefetch_related("ticks")
            .annotate(
                tick_count_annotated=Count("ticks", distinct=True),
                avg_rating_annotated=Avg("ticks__rating"),
            )
        )
        serializer = BoulderProblemListSerializer(problems, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def sectors(self, request, pk=None):
        """Get all sectors for a specific area (excluding secret sectors)"""
        area = self.get_object()
        sectors = area.sectors.filter(is_secret=False)
        serializer = SectorListSerializer(sectors, many=True)
        return Response(serializer.data)


class SectorViewSet(CreatedByMixin, ListDetailSerializerMixin, viewsets.ModelViewSet):
    queryset = Sector.objects.all()
    serializer_class = SectorSerializer
    list_serializer_class = SectorListSerializer
    filter_backends = [
        DjangoFilterBackend,
        NormalizedSearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["area"]
    search_fields = ["name", "description", "area__name"]
    ordering_fields = ["name", "created_at", "area", "problem_count_annotated"]
    ordering = ["-problem_count_annotated", "area", "name"]  # Sort by problem_count descending by default

    def get_queryset(self):
        """Filter out sectors from secret areas and secret sectors"""
        queryset = super().get_queryset()
        queryset = queryset.filter(
            area__is_secret=False, is_secret=False
        ).select_related("area")
        # Annotate problem_count_annotated for sorting
        # Since we already filtered secret areas and sectors, we can just count all problems
        # Use different name to avoid conflict with model's @property problem_count
        queryset = queryset.annotate(
            problem_count_annotated=Count("problems", distinct=True)
        )
        return queryset

    @action(detail=True, methods=["get"])
    def problems(self, request, pk=None):
        """Get all problems for a specific sector (excluding secret sectors)"""
        sector = self.get_object()
        # Optimize queryset to avoid N+1 queries
        # Filter out problems from secret sectors
        problems = (
            sector.problems.filter(area__is_secret=False)
            .filter(Q(sector__isnull=True) | Q(sector__is_secret=False))
            .select_related("area", "sector", "wall", "author", "created_by")
            .prefetch_related(
                "ticks",
                "image_lines__image",  # Prefetch images for media_count and primary_image
                "sector__images__image",  # Prefetch sector images for primary_image fallback
            )
            .annotate(
                tick_count_annotated=Count("ticks", distinct=True),
                avg_rating_annotated=Avg("ticks__rating"),
            )
        )
        serializer = BoulderProblemListSerializer(problems, many=True, context={"request": request})
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def walls(self, request, pk=None):
        """Get all walls for a specific sector"""
        sector = self.get_object()
        walls = sector.walls.all()
        serializer = WallSerializer(walls, many=True)
        return Response(serializer.data)


class WallViewSet(CreatedByMixin, viewsets.ModelViewSet):
    queryset = Wall.objects.all()
    serializer_class = WallSerializer
    filter_backends = [
        DjangoFilterBackend,
        NormalizedSearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["sector"]
    search_fields = ["name", "description", "sector__name", "sector__area__name"]
    ordering_fields = ["name", "created_at"]
    ordering = ["sector", "name"]

    def get_queryset(self):
        """Filter out walls from secret areas"""
        queryset = super().get_queryset()
        queryset = queryset.filter(sector__area__is_secret=False).select_related(
            "sector"
        )
        return queryset

    @action(detail=True, methods=["get"])
    def problems(self, request, pk=None):
        """Get all problems for a specific wall (excluding secret sectors)"""
        wall = self.get_object()
        # Optimize queryset to avoid N+1 queries
        # Filter out problems from secret sectors
        problems = (
            wall.problems.filter(area__is_secret=False)
            .filter(Q(sector__isnull=True) | Q(sector__is_secret=False))
            .select_related("area", "sector", "wall", "author", "created_by")
            .prefetch_related("ticks")
            .annotate(
                tick_count_annotated=Count("ticks", distinct=True),
                avg_rating_annotated=Avg("ticks__rating"),
            )
        )
        serializer = BoulderProblemListSerializer(problems, many=True)
        return Response(serializer.data)


class BoulderProblemViewSet(CreatedByMixin, viewsets.ModelViewSet):
    queryset = BoulderProblem.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        NormalizedSearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["area", "sector", "wall", "grade"]
    search_fields = ["name", "description", "area__name", "sector__name", "wall__name"]
    ordering_fields = ["grade", "name", "created_at"]
    ordering = ["area", "sector", "wall", "name"]

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter out problems from secret areas and secret sectors
        # Include problems with no sector (sector__isnull=True) or non-secret sectors
        queryset = queryset.filter(
            area__is_secret=False
        ).filter(
            Q(sector__isnull=True) | Q(sector__is_secret=False)
        )

        # Annotate aggregations to avoid N+1 queries
        queryset = queryset.annotate(
            tick_count_annotated=Count("ticks", distinct=True),
            avg_rating_annotated=Avg("ticks__rating"),
        )

        if self.action == "retrieve":
            # Prefetch image_lines and their images for detail view
            queryset = queryset.prefetch_related(
                "image_lines__image__problem_lines__problem"
            )
        elif self.action == "list":
            # For list view, prefetch related objects to avoid N+1 queries
            queryset = queryset.select_related(
                "area", "sector", "wall", "author", "created_by"
            )
            queryset = queryset.prefetch_related(
                "ticks",
                "image_lines__image",  # Prefetch images for media_count and primary_image
                "sector__images__image",  # Prefetch sector images for primary_image fallback
            )

        return queryset

    def get_serializer_class(self):
        if self.action == "list":
            return BoulderProblemListSerializer
        return BoulderProblemSerializer

    @action(detail=True, methods=["get"])
    def statistics(self, request, pk=None):
        """Get statistics for a problem: height distribution and grade voting"""
        from lists.models import Tick
        from lists.services import calculate_problem_statistics

        problem = self.get_object()
        ticks = Tick.objects.filter(problem=problem).select_related("user__profile")

        # Convert queryset to list of dictionaries for service function
        ticks_data = ticks.values(
            "user__profile__height",
            "suggested_grade",
        )

        # Calculate statistics using service function
        stats = calculate_problem_statistics(list(ticks_data))

        # Convert to REST API format (snake_case)
        return Response(
            {
                "total_ticks": stats["totalTicks"],
                "height_distribution": stats["heightDistribution"],
                "height_data_count": stats["heightDataCount"],
                "grade_voting": stats["gradeVoting"],
                "grade_votes_count": stats["gradeVotesCount"],
            }
        )


class BoulderImageViewSet(CreatedByMixin, viewsets.ModelViewSet):
    queryset = BoulderImage.objects.all()
    serializer_class = BoulderImageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["sector", "is_primary"]
    # Note: To filter by problem, use the problem_lines relationship:
    # /api/boulders/images/?problem_lines__problem=<problem_id>

    def get_queryset(self):
        # Prefetch problem lines for better performance
        queryset = super().get_queryset().prefetch_related("problem_lines__problem")

        # Allow filtering by problem through problem_lines relationship
        problem_id = self.request.query_params.get("problem")
        if problem_id:
            queryset = queryset.filter(problem_lines__problem_id=problem_id).distinct()

        return queryset

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
