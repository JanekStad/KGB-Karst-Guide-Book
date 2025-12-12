"""
Top-level conftest.py for shared boulder-related fixtures.
These fixtures are available to all tests across all apps.
"""

import pytest

from boulders.models import City, Area, Sector, Wall, BoulderProblem


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
