import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from users.models import UserProfile


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user(db):

    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def user_with_profile(user):
    profile = user.profile
    profile.bio = "Test bio"
    profile.height = "170-175"
    profile.ape_index = 2.5
    profile.save()
    return user


@pytest.fixture
def authenticated_client(api_client, user):
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api_client


@pytest.fixture
def multiple_users(db):
    users = []
    for i in range(5):
        user = User.objects.create_user(
            username=f"user{i}",
            email=f"user{i}@example.com",
            password="testpass123",
        )
        users.append(user)
    return users
