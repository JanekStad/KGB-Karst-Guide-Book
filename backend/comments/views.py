from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import Comment
from .serializers import CommentSerializer, CommentCreateSerializer


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return CommentCreateSerializer
        return CommentSerializer

    def get_queryset(self):
        queryset = Comment.objects.all()
        problem_id = self.request.query_params.get("problem", None)
        if problem_id:
            queryset = queryset.filter(problem_id=problem_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
