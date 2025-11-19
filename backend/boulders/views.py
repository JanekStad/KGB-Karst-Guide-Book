from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import City, Crag, Wall, BoulderProblem, BoulderImage
from .serializers import (
    CitySerializer,
    CityListSerializer,
    CragSerializer,
    CragListSerializer,
    WallSerializer,
    BoulderProblemSerializer,
    BoulderProblemListSerializer,
    BoulderImageSerializer,
)


class CityViewSet(viewsets.ModelViewSet):
    queryset = City.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action == "list":
            return CityListSerializer
        return CitySerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def crags(self, request, pk=None):
        """Get all crags for a specific city"""
        city = self.get_object()
        crags = city.crags.all()
        serializer = CragListSerializer(crags, many=True)
        return Response(serializer.data)


class CragViewSet(viewsets.ModelViewSet):
    queryset = Crag.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["city"]
    search_fields = ["name", "description", "city__name"]
    ordering_fields = ["name", "created_at", "city"]
    ordering = ["city", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return CragListSerializer
        return CragSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def problems(self, request, pk=None):
        """Get all problems for a specific crag"""
        crag = self.get_object()
        problems = crag.problems.all()
        serializer = BoulderProblemListSerializer(problems, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def walls(self, request, pk=None):
        """Get all walls for a specific crag"""
        crag = self.get_object()
        walls = crag.walls.all()
        serializer = WallSerializer(walls, many=True)
        return Response(serializer.data)


class WallViewSet(viewsets.ModelViewSet):
    queryset = Wall.objects.all()
    serializer_class = WallSerializer
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["crag"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["crag", "name"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def problems(self, request, pk=None):
        """Get all problems for a specific wall"""
        wall = self.get_object()
        problems = wall.problems.all()
        serializer = BoulderProblemListSerializer(problems, many=True)
        return Response(serializer.data)


class BoulderProblemViewSet(viewsets.ModelViewSet):
    queryset = BoulderProblem.objects.all()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["crag", "wall", "grade"]
    search_fields = ["name", "description", "crag__name", "wall__name"]
    ordering_fields = ["grade", "name", "created_at"]
    ordering = ["crag", "wall", "name"]

    def get_serializer_class(self):
        if self.action == "list":
            return BoulderProblemListSerializer
        return BoulderProblemSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["get"])
    def statistics(self, request, pk=None):
        """Get statistics for a problem: height distribution and grade voting"""
        from django.db.models import Count, Q
        from lists.models import Tick
        from users.models import UserProfile

        problem = self.get_object()
        ticks = Tick.objects.filter(problem=problem).select_related("user__profile")

        # Height distribution
        height_stats = {}
        for height_choice in UserProfile.HEIGHT_CHOICES:
            height_value = height_choice[0]
            count = ticks.filter(user__profile__height=height_value).count()
            if count > 0:
                height_stats[height_value] = {"label": height_choice[1], "count": count}

        # Grade voting distribution
        grade_stats = {}
        for grade_choice in Tick.GRADE_CHOICES:
            grade_value = grade_choice[0]
            count = (
                ticks.filter(suggested_grade=grade_value)
                .exclude(suggested_grade__isnull=True)
                .exclude(suggested_grade="")
                .count()
            )
            if count > 0:
                grade_stats[grade_value] = {"label": grade_choice[1], "count": count}

        # Total ticks count
        total_ticks = ticks.count()
        ticks_with_height = (
            ticks.filter(user__profile__height__isnull=False)
            .exclude(user__profile__height="")
            .count()
        )
        ticks_with_grade_vote = (
            ticks.exclude(suggested_grade__isnull=True)
            .exclude(suggested_grade="")
            .count()
        )

        return Response(
            {
                "total_ticks": total_ticks,
                "height_distribution": height_stats,
                "height_data_count": ticks_with_height,
                "grade_voting": grade_stats,
                "grade_votes_count": ticks_with_grade_vote,
            }
        )


class BoulderImageViewSet(viewsets.ModelViewSet):
    queryset = BoulderImage.objects.all()
    serializer_class = BoulderImageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["wall", "problem", "is_primary"]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)
