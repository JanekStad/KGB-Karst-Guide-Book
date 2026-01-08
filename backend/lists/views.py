from typing import Any

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.db.models import Count, Min, Max
from collections import Counter
from datetime import datetime, timedelta
from django.contrib.auth.models import User
from karst_backend.throttles import MutationRateThrottle
from boulders.models import BoulderProblem, Area
from .models import Tick, UserList, ListEntry
from .serializers import (
    TickSerializer,
    TickCreateSerializer,
    UserListSerializer,
    UserListCreateSerializer,
    ListEntrySerializer,
    ListEntryCreateSerializer,
)
from .services import import_lezec_diary


class TickViewSet(viewsets.ModelViewSet):
    serializer_class = TickSerializer
    permission_classes = [IsAuthenticated]
    filter_backends: list[Any] = []

    def get_throttles(self):
        """Apply stricter throttling for mutations"""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [MutationRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        # Optimize queryset to avoid N+1 queries
        return (
            Tick.objects.filter(user=self.request.user)
            .select_related(
                "user",
                "user__profile",
                "problem",
                "problem__area",
                "problem__area__city",
            )
            .prefetch_related("problem__sector", "problem__wall")
        )

    def get_permissions(self):
        """
        Allow public read access for problem_ticks, user_diary, recent, and community_stats actions
        """
        if self.action in ["problem_ticks", "user_diary", "recent", "community_stats"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "create":
            return TickCreateSerializer
        return TickSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        response_serializer = TickSerializer(serializer.instance)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def my_ticks(self, request):
        """Get current user's ticks"""
        ticks = self.get_queryset()
        serializer = self.get_serializer(ticks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def problem_ticks(self, request):
        """Get all ticks for a specific problem (public access)"""
        problem_id = request.query_params.get("problem")
        if not problem_id:
            return Response(
                {"error": "problem parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ticks = (
            Tick.objects.filter(problem_id=problem_id)
            .select_related("user", "user__profile", "problem")
            .order_by("-date", "-created_at")
        )

        serializer = self.get_serializer(ticks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def user_diary(self, request):
        """Get all ticks for a specific user (public access - user's diary)"""
        user_id = request.query_params.get("user")
        if not user_id:
            return Response(
                {"error": "user parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:

            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        ticks = (
            Tick.objects.filter(user=user)
            .select_related(
                "user",
                "user__profile",
                "problem",
                "problem__area",
                "problem__area__city",
            )
            .order_by("-date", "-created_at")
        )

        serializer = self.get_serializer(ticks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def recent(self, request):
        """Get recent ticks from all users (public access - community activity feed)"""
        limit = int(request.query_params.get("limit", 20))  # Default to 20, max 50

        # Cap the limit to prevent abuse
        if limit > 50:
            limit = 50

        ticks = Tick.objects.select_related(
            "user", "user__profile", "problem", "problem__area", "problem__area__city"
        ).order_by("-date", "-created_at")[:limit]

        serializer = self.get_serializer(ticks, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], permission_classes=[AllowAny])
    def community_stats(self, request):
        """Get community-wide statistics (public access)"""
        # Total problems
        total_problems = BoulderProblem.objects.filter(area__is_secret=False).count()

        # Total ticks
        total_ticks = Tick.objects.count()

        # Active climbers (users who have at least one tick)
        active_climbers = User.objects.filter(ticks__isnull=False).distinct().count()

        # Total areas
        total_areas = Area.objects.filter(is_secret=False).count()

        # Recent activity (ticks in last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_ticks = Tick.objects.filter(created_at__gte=thirty_days_ago).count()

        # Most ticked problem - optimized to avoid N+1 query
        most_ticked = (
            Tick.objects.values("problem")
            .annotate(tick_count=Count("id"))
            .order_by("-tick_count")
            .first()
        )

        most_ticked_problem = None
        if most_ticked:
            try:
                # Use select_related to avoid separate query
                problem = (
                    BoulderProblem.objects.select_related("area")
                    .filter(id=most_ticked["problem"])
                    .first()
                )
                if problem:
                    most_ticked_problem = {
                        "name": problem.name,
                        "grade": problem.grade,
                        "tick_count": most_ticked["tick_count"],
                    }
            except BoulderProblem.DoesNotExist:
                pass

        return Response(
            {
                "total_problems": total_problems,
                "total_ticks": total_ticks,
                "active_climbers": active_climbers,
                "total_areas": total_areas,
                "recent_ticks_30d": recent_ticks,
                "most_ticked_problem": most_ticked_problem,
            }
        )

    @action(detail=False, methods=["post"])
    def import_lezec_diary(self, request):
        """
        Import ticks from lezec.cz public diary.

        Expected payload:
        {
            "lezec_username": "Lucaa"
        }
        """
        lezec_username = request.data.get("lezec_username")
        if not lezec_username:
            return Response(
                {"error": "lezec_username is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = import_lezec_diary(request.user, lezec_username)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"error": str(e), "message": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"])
    def statistics(self, request):
        """Get statistics for the current user's ticks"""
        ticks = self.get_queryset().select_related(
            "problem", "problem__area", "problem__area__city"
        )

        if not ticks.exists():
            return Response(
                {
                    "total_ticks": 0,
                    "message": "No ticks found. Start climbing to see your statistics!",
                }
            )

        # Grade order for determining hardest grade
        GRADE_ORDER = [
            "3",
            "3+",
            "4",
            "4+",
            "5",
            "5+",
            "6A",
            "6A+",
            "6B",
            "6B+",
            "6C",
            "6C+",
            "7A",
            "7A+",
            "7B",
            "7B+",
            "7C",
            "7C+",
            "8A",
            "8A+",
            "8B",
            "8B+",
            "8C",
            "8C+",
            "9A",
            "9A+",
        ]

        # Basic counts
        total_ticks = ticks.count()

        # Date statistics
        date_stats = ticks.aggregate(first_send=Min("date"), latest_send=Max("date"))

        # Helper function to get effective grade for a tick
        def get_effective_grade(tick):
            """Returns tick_grade if set, otherwise falls back to problem.grade"""
            return tick.tick_grade if tick.tick_grade else tick.problem.grade

        # Grade statistics - use tick_grade if present, otherwise problem.grade
        grade_counts = Counter(
            get_effective_grade(tick) for tick in ticks if get_effective_grade(tick)
        )
        grade_distribution = {
            grade: grade_counts.get(grade, 0)
            for grade in GRADE_ORDER
            if grade in grade_counts
        }

        # Find hardest grade - use tick_grade if present, otherwise problem.grade
        hardest_grade = None
        hardest_index = -1
        for tick in ticks:
            effective_grade = get_effective_grade(tick)
            if effective_grade:
                idx = GRADE_ORDER.index(effective_grade)
                if idx > hardest_index:
                    hardest_index = idx
                    hardest_grade = effective_grade

        # Area statistics
        area_counts = Counter(
            (tick.problem.area.id, tick.problem.area.name)
            for tick in ticks
            if tick.problem.area
        )
        most_climbed_area = None
        if area_counts:
            most_climbed_area_id, most_climbed_area_name = area_counts.most_common(1)[
                0
            ][0]
            most_climbed_area = {
                "id": most_climbed_area_id,
                "name": most_climbed_area_name,
                "tick_count": area_counts.most_common(1)[0][1],
            }

        # City statistics
        city_counts = Counter(
            (tick.problem.area.city.id, tick.problem.area.city.name)
            for tick in ticks
            if tick.problem.area and tick.problem.area.city
        )
        most_climbed_city = None
        if city_counts:
            most_climbed_city_id, most_climbed_city_name = city_counts.most_common(1)[
                0
            ][0]
            most_climbed_city = {
                "id": most_climbed_city_id,
                "name": most_climbed_city_name,
                "tick_count": city_counts.most_common(1)[0][1],
            }

        # Unique locations
        unique_areas = len(
            set(tick.problem.area.id for tick in ticks if tick.problem.area)
        )
        unique_cities = len(
            set(
                tick.problem.area.city.id
                for tick in ticks
                if tick.problem.area and tick.problem.area.city
            )
        )

        # Rating statistics
        ratings_with_values = [
            float(tick.rating) for tick in ticks if tick.rating is not None
        ]
        average_rating = (
            sum(ratings_with_values) / len(ratings_with_values)
            if ratings_with_values
            else None
        )
        rated_problems_count = len(ratings_with_values)

        # Activity by year
        ticks_by_year = Counter(tick.date.year for tick in ticks if tick.date)
        ticks_per_year = {
            str(year): count for year, count in sorted(ticks_by_year.items())
        }
        most_active_year = None
        if ticks_by_year:
            most_active_year = max(ticks_by_year.items(), key=lambda x: x[1])
            most_active_year = {
                "year": most_active_year[0],
                "tick_count": most_active_year[1],
            }

        # Activity by month (across all years)
        ticks_by_month = Counter(tick.date.month for tick in ticks if tick.date)
        month_names = {
            1: "January",
            2: "February",
            3: "March",
            4: "April",
            5: "May",
            6: "June",
            7: "July",
            8: "August",
            9: "September",
            10: "October",
            11: "November",
            12: "December",
        }
        ticks_per_month = {
            month_names[month]: count for month, count in sorted(ticks_by_month.items())
        }
        most_active_month = None
        if ticks_by_month:
            most_active_month_num = max(ticks_by_month.items(), key=lambda x: x[1])[0]
            most_active_month = {
                "month": most_active_month_num,
                "month_name": month_names[most_active_month_num],
                "tick_count": ticks_by_month[most_active_month_num],
            }

        # Calculate climbing span
        climbing_span_years = None
        if date_stats["first_send"] and date_stats["latest_send"]:
            delta = date_stats["latest_send"] - date_stats["first_send"]
            climbing_span_years = round(delta.days / 365.25, 1)

        # Average ticks per year
        avg_ticks_per_year = None
        if climbing_span_years and climbing_span_years > 0:
            avg_ticks_per_year = round(total_ticks / climbing_span_years, 1)

        return Response(
            {
                "total_ticks": total_ticks,
                "hardest_grade": hardest_grade,
                "grade_distribution": grade_distribution,
                "first_send": (
                    date_stats["first_send"].isoformat()
                    if date_stats["first_send"]
                    else None
                ),
                "latest_send": (
                    date_stats["latest_send"].isoformat()
                    if date_stats["latest_send"]
                    else None
                ),
                "climbing_span_years": climbing_span_years,
                "unique_areas": unique_areas,
                "unique_crags": unique_areas,  # Backward compatibility alias
                "unique_cities": unique_cities,
                "most_climbed_area": most_climbed_area,
                "most_climbed_crag": most_climbed_area,  # Backward compatibility alias
                "most_climbed_city": most_climbed_city,
                "average_rating": round(average_rating, 2) if average_rating else None,
                "rated_problems_count": rated_problems_count,
                "ticks_per_year": ticks_per_year,
                "most_active_year": most_active_year,
                "ticks_per_month": ticks_per_month,
                "most_active_month": most_active_month,
                "avg_ticks_per_year": avg_ticks_per_year,
            }
        )


class UserListViewSet(viewsets.ModelViewSet):
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply stricter throttling for mutations"""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [MutationRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        # Prefetch list entries to avoid N+1 queries in serializer
        return (
            UserList.objects.filter(user=self.request.user)
            .prefetch_related("listentry_set__problem")
            .annotate(problem_count_annotated=Count("listentry_set", distinct=True))
        )

    def get_serializer_class(self):
        if self.action == "create":
            return UserListCreateSerializer
        return UserListSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        response_serializer = UserListSerializer(serializer.instance)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def add_problem(self, request, pk=None):
        """Add a problem to this list"""
        user_list = self.get_object()
        serializer = ListEntryCreateSerializer(data=request.data)
        if serializer.is_valid():
            problem = serializer.validated_data["problem"]
            notes = serializer.validated_data.get("notes", "")
            entry, created = ListEntry.objects.get_or_create(
                user_list=user_list, problem=problem, defaults={"notes": notes}
            )
            if not created:
                entry.notes = notes
                entry.save()
            return Response(
                ListEntrySerializer(entry).data,
                status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["delete"])
    def remove_problem(self, request, pk=None):
        """Remove a problem from this list"""
        user_list = self.get_object()
        problem_id = request.data.get("problem")
        if not problem_id:
            return Response(
                {"error": "problem ID is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            entry = ListEntry.objects.get(user_list=user_list, problem_id=problem_id)
            entry.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ListEntry.DoesNotExist:
            return Response(
                {"error": "Problem not found in list"}, status=status.HTTP_404_NOT_FOUND
            )


class ListEntryViewSet(viewsets.ModelViewSet):
    serializer_class = ListEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_throttles(self):
        """Apply stricter throttling for mutations"""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [MutationRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        return ListEntry.objects.filter(user_list__user=self.request.user)
