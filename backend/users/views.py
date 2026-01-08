from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from backend.users.models import UserProfile
from backend.users.serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserProfileSerializer,
)
from lists.serializers import TickSerializer
from lists.models import Tick


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [AllowAny]

    @action(detail=True, methods=["get"])
    def profile(self, request, pk=None):
        """Get user profile"""
        user = self.get_object()
        if hasattr(user, "profile"):
            serializer = UserProfileSerializer(user.profile)
            return Response(serializer.data)
        return Response(
            {"detail": "Profile not found"}, status=status.HTTP_404_NOT_FOUND
        )

    @action(detail=True, methods=["get"], permission_classes=[AllowAny])
    def ticks(self, request, pk=None):
        """
        Get user's ticks (read-only, public access).
        Similar to my_ticks but for any user by ID.
        """
        user = self.get_object()

        # Get user's ticks with optimized queries
        ticks = (
            Tick.objects.filter(user=user)
            .select_related(
                "user",
                "user__profile",
                "problem",
                "problem__area",
                "problem__area__city",
            )
            .prefetch_related("problem__sector", "problem__wall")
            .order_by("-date", "-created_at")
        )

        # Serialize user info and ticks
        user_serializer = UserSerializer(user)
        ticks_serializer = TickSerializer(ticks, many=True)

        return Response(
            {
                "user": user_serializer.data,
                "ticks": ticks_serializer.data,
            }
        )

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def register(self, request):
        """User registration endpoint"""
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Update profile if height or ape_index provided
            if hasattr(user, "profile"):
                profile_data = {}
                if "height" in request.data:
                    profile_data["height"] = request.data["height"]
                if "ape_index" in request.data and request.data["ape_index"]:
                    try:
                        profile_data["ape_index"] = float(request.data["ape_index"])
                    except (ValueError, TypeError):
                        pass

                if profile_data:
                    profile_serializer = UserProfileSerializer(
                        user.profile, data=profile_data, partial=True
                    )
                    if profile_serializer.is_valid():
                        profile_serializer.save()

            # Create token for the user
            token, created = Token.objects.get_or_create(user=user)
            return Response(
                {"user": UserSerializer(user).data, "token": token.key},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        """Get current user's profile"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def login(self, request):
        """Token-based login endpoint"""
        username = request.data.get("username")
        password = request.data.get("password")

        if not username or not password:
            return Response(
                {"error": "Username and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(username=username, password=password)
        if user:
            token, created = Token.objects.get_or_create(user=user)
            return Response({"token": token.key, "user": UserSerializer(user).data})
        else:
            return Response(
                {"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )


class UserProfileViewSet(viewsets.ModelViewSet):
    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get", "patch"])
    def me(self, request):
        """Get or update current user's profile"""
        profile, created = UserProfile.objects.get_or_create(user=request.user)

        if request.method == "GET":
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)
        elif request.method == "PATCH":
            serializer = UserProfileSerializer(profile, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
