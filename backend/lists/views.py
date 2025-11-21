from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Avg, Min, Max, Q
from django.db.models.functions import ExtractYear, ExtractMonth
from collections import Counter
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
    filter_backends = []

    def get_queryset(self):
        return Tick.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return TickCreateSerializer
        return TickSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"])
    def my_ticks(self, request):
        """Get current user's ticks"""
        ticks = self.get_queryset()
        serializer = self.get_serializer(ticks, many=True)
        return Response(serializer.data)

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
            "problem", "problem__crag", "problem__crag__city"
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

        # Grade statistics
        grade_counts = Counter(
            tick.problem.grade for tick in ticks if tick.problem.grade
        )
        grade_distribution = {
            grade: grade_counts.get(grade, 0)
            for grade in GRADE_ORDER
            if grade in grade_counts
        }

        # Find hardest grade
        hardest_grade = None
        hardest_index = -1
        for tick in ticks:
            if tick.problem.grade:
                idx = GRADE_ORDER.index(tick.problem.grade)
                if idx > hardest_index:
                    hardest_index = idx
                    hardest_grade = tick.problem.grade

        # Crag statistics
        crag_counts = Counter(
            (tick.problem.crag.id, tick.problem.crag.name)
            for tick in ticks
            if tick.problem.crag
        )
        most_climbed_crag = None
        if crag_counts:
            most_climbed_crag_id, most_climbed_crag_name = crag_counts.most_common(1)[
                0
            ][0]
            most_climbed_crag = {
                "id": most_climbed_crag_id,
                "name": most_climbed_crag_name,
                "tick_count": crag_counts.most_common(1)[0][1],
            }

        # City statistics
        city_counts = Counter(
            (tick.problem.crag.city.id, tick.problem.crag.city.name)
            for tick in ticks
            if tick.problem.crag and tick.problem.crag.city
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
        unique_crags = len(
            set(tick.problem.crag.id for tick in ticks if tick.problem.crag)
        )
        unique_cities = len(
            set(
                tick.problem.crag.city.id
                for tick in ticks
                if tick.problem.crag and tick.problem.crag.city
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
                "unique_crags": unique_crags,
                "unique_cities": unique_cities,
                "most_climbed_crag": most_climbed_crag,
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

    def get_queryset(self):
        return UserList.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == "create":
            return UserListCreateSerializer
        return UserListSerializer

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

    def get_queryset(self):
        return ListEntry.objects.filter(user_list__user=self.request.user)
