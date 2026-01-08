from rest_framework import viewsets, filters, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from karst_backend.throttles import MutationRateThrottle, AnonMutationRateThrottle
from backend.comments.models import Comment
from backend.comments.serializers import CommentSerializer, CommentCreateSerializer


class CommentViewSet(viewsets.ModelViewSet):
    queryset = Comment.objects.all()
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_throttles(self):
        """Apply stricter throttling for mutations"""
        if self.action in ["create", "update", "partial_update", "destroy"]:
            if self.request.user.is_authenticated:
                return [MutationRateThrottle()]
            else:
                return [AnonMutationRateThrottle()]
        return super().get_throttles()

    def get_serializer_class(self):
        if self.action == "create":
            return CommentCreateSerializer
        return CommentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Optimize queryset to avoid N+1 queries
        queryset = queryset.select_related("user", "problem")
        problem_id = self.request.query_params.get("problem", None)
        if problem_id:
            queryset = queryset.filter(problem_id=problem_id)
        return queryset

    def create(self, request, *args, **kwargs):
        """Override create to return full CommentSerializer in response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        # Return the full serializer for the response
        response_serializer = CommentSerializer(serializer.instance)
        return Response(
            response_serializer.data, status=status.HTTP_201_CREATED, headers=headers
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
