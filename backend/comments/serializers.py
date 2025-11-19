from rest_framework import serializers
from .models import Comment
from users.serializers import UserSerializer


class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = [
            "id",
            "problem",
            "user",
            "content",
            "created_at",
            "updated_at",
            "edited",
        ]
        read_only_fields = ["user", "created_at", "updated_at", "edited"]

    def update(self, instance, validated_data):
        instance.edited = True
        return super().update(instance, validated_data)


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["problem", "content"]
