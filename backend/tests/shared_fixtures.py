"""
Shared fixtures available to all tests.
This module is loaded via pytest_plugins in the root conftest.py.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework.authtoken.models import Token
from boulders.models import City, Area, Sector, Wall, BoulderProblem


# ============================================================================
# Auth-related fixtures
# ============================================================================


@pytest.fixture
def api_client():
    """Create an API client for testing"""
    return APIClient()


@pytest.fixture
def user(db):
    """Create a test user"""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
    )


@pytest.fixture
def user_with_profile(user):
    """Create a test user with a populated profile"""
    profile = user.profile
    profile.bio = "Test bio"
    profile.height = "170-175"
    profile.ape_index = 2.5
    profile.save()
    return user


@pytest.fixture
def authenticated_client(api_client, user):
    """Create an authenticated API client"""
    token, _ = Token.objects.get_or_create(user=user)
    api_client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")
    return api_client


@pytest.fixture
def multiple_users(db):
    """Create multiple test users"""
    users = []
    for i in range(5):
        user = User.objects.create_user(
            username=f"user{i}",
            email=f"user{i}@example.com",
            password="testpass123",
        )
        users.append(user)
    return users


# ============================================================================
# Boulder-related fixtures
# ============================================================================


@pytest.fixture
def city(db):
    """Create a test city"""
    return City.objects.create(
        name="Test City",
        description="A test city",
    )


@pytest.fixture
def area(db, city):
    """Create a test area"""
    return Area.objects.create(
        city=city,
        name="Test Area",
        description="A test area",
        is_secret=False,
    )


@pytest.fixture
def secret_area(db, city):
    """Create a secret test area"""
    return Area.objects.create(
        city=city,
        name="Secret Area",
        description="A secret area",
        is_secret=True,
    )


@pytest.fixture
def sector(db, area):
    """Create a test sector"""
    return Sector.objects.create(
        area=area,
        name="Test Sector",
        description="A test sector",
        latitude=49.123456,
        longitude=16.654321,
        is_secret=False,
    )


@pytest.fixture
def wall(db, sector):
    """Create a test wall"""
    return Wall.objects.create(
        sector=sector,
        name="Test Wall",
        description="A test wall",
    )


@pytest.fixture
def boulder_problem(db, area, sector, wall, user):
    """Create a test boulder problem"""
    return BoulderProblem.objects.create(
        area=area,
        sector=sector,
        wall=wall,
        name="Test Problem",
        description="A test problem",
        grade="7A",
        created_by=user,
    )


@pytest.fixture
def multiple_problems(db, area, sector, wall, user):
    """Create multiple test problems"""
    problems = []
    grades = ["6A", "6B", "7A", "7B", "8A"]
    for i, grade in enumerate(grades):
        problem = BoulderProblem.objects.create(
            area=area,
            sector=sector,
            wall=wall,
            name=f"Problem {i+1}",
            description=f"Test problem {i+1}",
            grade=grade,
            created_by=user,
        )
        problems.append(problem)
    return problems
