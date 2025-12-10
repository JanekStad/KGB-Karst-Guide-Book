import pytest
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.authtoken.models import Token


@pytest.mark.django_db
class TestUserViewSet:

    def test_list_users(self, api_client, user):
        response = api_client.get("/api/users/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_retrieve_user(self, api_client, user):
        response = api_client.get(f"/api/users/{user.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == user.username

    def test_get_user_profile(self, api_client, user_with_profile):
        response = api_client.get(f"/api/users/{user_with_profile.id}/profile/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["bio"] == "Test bio"
        assert response.data["height"] == "170-175"

    def test_register_user(self, api_client):
        response = api_client.post(
            "/api/users/register/",
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "securepass123",
                "password_confirm": "securepass123",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert "token" in response.data
        assert response.data["user"]["username"] == "newuser"

        # Verify user was created
        user = User.objects.get(username="newuser")
        assert user.email == "newuser@example.com"

        # Verify token was created
        assert Token.objects.filter(user=user).exists()

    def test_register_user_with_profile_data(self, api_client):
        response = api_client.post(
            "/api/users/register/",
            {
                "username": "newuser2",
                "email": "newuser2@example.com",
                "password": "securepass123",
                "password_confirm": "securepass123",
                "height": "170-175",
                "ape_index": "3.5",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        user = User.objects.get(username="newuser2")
        assert user.profile.height == "170-175"
        assert float(user.profile.ape_index) == 3.5

    def test_register_user_password_mismatch(self, api_client):
        response = api_client.post(
            "/api/users/register/",
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "securepass123",
                "password_confirm": "differentpass",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_success(self, api_client, user):
        response = api_client.post(
            "/api/users/login/",
            {"username": "testuser", "password": "testpass123"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert "token" in response.data
        assert response.data["user"]["username"] == "testuser"

    def test_login_invalid_credentials(self, api_client, user):
        response = api_client.post(
            "/api/users/login/",
            {"username": "testuser", "password": "wrongpassword"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "error" in response.data

    def test_login_missing_fields(self, api_client):
        response = api_client.post("/api/users/login/", {"username": "testuser"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_get_current_user(self, authenticated_client, user):
        response = authenticated_client.get("/api/users/me/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == user.username
        assert response.data["id"] == user.id

    def test_get_current_user_requires_auth(self, api_client):
        response = api_client.get("/api/users/me/")
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestUserProfileViewSet:

    def test_get_own_profile(self, authenticated_client, user_with_profile):
        response = authenticated_client.get("/api/profiles/me/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["bio"] == "Test bio"

    def test_update_own_profile(self, authenticated_client, user):
        response = authenticated_client.patch(
            "/api/profiles/me/",
            {"bio": "Updated bio", "height": "175-180"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["bio"] == "Updated bio"
        assert response.data["height"] == "175-180"

        # Verify changes were saved
        user.profile.refresh_from_db()
        assert user.profile.bio == "Updated bio"
        assert user.profile.height == "175-180"

    def test_get_profile_requires_auth(self, api_client):
        response = api_client.get("/api/profiles/me/")
        assert response.status_code == status.HTTP_403_FORBIDDEN
