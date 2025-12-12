from rest_framework import serializers
from .models import Tick, UserList, ListEntry
from boulders.serializers import BoulderProblemSerializer
from users.serializers import UserSerializer


class TickSerializer(serializers.ModelSerializer):
    problem = BoulderProblemSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Tick
        fields = [
            "id",
            "user",
            "problem",
            "date",
            "notes",
            "tick_grade",
            "suggested_grade",
            "rating",
            "created_at",
        ]
        read_only_fields = ["user", "created_at"]


class TickCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tick
        fields = ["problem", "date", "notes", "tick_grade", "suggested_grade", "rating"]

    def validate(self, attrs):
        """Check if a tick already exists for this user and problem"""
        user = self.context["request"].user
        problem = attrs.get("problem")

        if problem and Tick.objects.filter(user=user, problem=problem).exists():
            raise serializers.ValidationError(
                {"non_field_errors": ["You have already ticked this problem."]}
            )

        return attrs


class ListEntrySerializer(serializers.ModelSerializer):
    problem = BoulderProblemSerializer(read_only=True)

    class Meta:
        model = ListEntry
        fields = ["id", "problem", "added_at", "notes"]
        read_only_fields = ["added_at"]


class UserListSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    problems = ListEntrySerializer(source="listentry_set", many=True, read_only=True)
    problem_count = serializers.SerializerMethodField()

    class Meta:
        model = UserList
        fields = [
            "id",
            "user",
            "name",
            "description",
            "is_public",
            "problems",
            "problem_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["user", "created_at", "updated_at"]

    def get_problem_count(self, obj):
        # Use annotated count if available (from queryset optimization), otherwise fallback
        if hasattr(obj, "problem_count_annotated"):
            return obj.problem_count_annotated
        return obj.problems.count()


class UserListCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserList
        fields = ["name", "description", "is_public"]


class ListEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListEntry
        fields = ["problem", "notes"]
