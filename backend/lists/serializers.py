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
            "suggested_grade",
            "created_at",
        ]
        read_only_fields = ["user", "created_at"]


class TickCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tick
        fields = ["problem", "date", "notes", "suggested_grade"]


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
        return obj.problems.count()


class UserListCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserList
        fields = ["name", "description", "is_public"]


class ListEntryCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListEntry
        fields = ["problem", "notes"]
