import pytest
from ariadne import graphql
from gql.schema import schema
from lists.models import Tick
from comments.models import Comment
from users.models import UserProfile


@pytest.fixture
def graphql_query():
    """Helper fixture to execute GraphQL queries"""

    async def execute(query, variables=None, context_value=None):
        success, result = await graphql(
            schema,
            {"query": query, "variables": variables or {}},
            context_value=context_value or {},
        )
        return success, result

    return execute


@pytest.fixture
def graphql_context(user):
    """Create GraphQL context with authenticated user"""
    return {"request": None, "user": user}


@pytest.fixture
def graphql_context_anonymous():
    """Create GraphQL context without user"""
    return {"request": None, "user": None}


@pytest.fixture
def tick_with_profile(db, boulder_problem, user_with_profile):
    """Create a tick with user profile data for statistics testing"""
    return Tick.objects.create(
        user=user_with_profile,
        problem=boulder_problem,
        date="2024-01-15",
        notes="Great problem!",
        tick_grade="7A",
        suggested_grade="7A+",
        rating=4.5,
    )


@pytest.fixture
def multiple_ticks(db, boulder_problem, multiple_users):
    """Create multiple ticks for a problem"""
    from datetime import date

    ticks = []
    for i, user in enumerate(
        multiple_users
    ):  # Create profile for each user with different heights
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                "height": ["<150", "150-155", "155-160", "160-165", "165-170"][i % 5]
            },
        )

        tick = Tick.objects.create(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15 + i),
            notes=f"Tick {i+1}",
            tick_grade="7A" if i % 2 == 0 else "7B",
            suggested_grade=["7A", "7A+", "7B", "7B+", "7C"][i % 5],
            rating=3.0 + (i * 0.5),
        )
        ticks.append(tick)
    return ticks


@pytest.fixture
def comment(db, boulder_problem, user):
    """Create a test comment"""
    return Comment.objects.create(
        user=user,
        problem=boulder_problem,
        content="This is a test comment",
    )


@pytest.fixture
def multiple_comments(db, boulder_problem, multiple_users):
    """Create multiple comments for a problem"""
    comments = []
    for i, user in enumerate(multiple_users):
        comment = Comment.objects.create(
            user=user,
            problem=boulder_problem,
            content=f"Comment {i+1}",
        )
        comments.append(comment)
    return comments
