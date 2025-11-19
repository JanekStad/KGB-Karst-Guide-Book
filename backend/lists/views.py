from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Tick, UserList, ListEntry
from .serializers import (
    TickSerializer,
    TickCreateSerializer,
    UserListSerializer,
    UserListCreateSerializer,
    ListEntrySerializer,
    ListEntryCreateSerializer,
)


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
