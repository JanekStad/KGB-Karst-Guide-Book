import pytest
from lists.models import Tick
from datetime import date
from asgiref.sync import sync_to_async


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestTickMutations:
    """Test GraphQL tick mutations"""

    async def test_create_tick_authenticated(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test creating a tick when authenticated"""
        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
                date
                notes
                tickGrade
                suggestedGrade
                rating
                user {
                    username
                }
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "date": "2024-01-15",
                "notes": "Great problem!",
                "tickGrade": "7A",
                "suggestedGrade": "7A+",
                "rating": 4.5,
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert success is True
        assert "errors" not in result or len(result.get("errors", [])) == 0
        assert result.get("data") is not None
        assert result["data"]["createTick"]["date"] == "2024-01-15"
        assert result["data"]["createTick"]["notes"] == "Great problem!"
        assert result["data"]["createTick"]["tickGrade"] == "7A"
        assert result["data"]["createTick"]["suggestedGrade"] == "7A+"
        assert result["data"]["createTick"]["rating"] == 4.5
        assert result["data"]["createTick"]["user"]["username"] == user.username

        # Verify tick was created in database

        tick_id = result["data"]["createTick"]["id"]
        # Convert string ID to int if needed
        if isinstance(tick_id, str):
            tick_id = int(tick_id)

        def get_tick():
            return Tick.objects.select_related("user", "problem").get(id=tick_id)

        tick = await sync_to_async(get_tick)()

        def verify_tick():
            assert tick.user.id == user.id
            assert tick.problem.id == boulder_problem.id
            assert tick.date == date(2024, 1, 15)

        await sync_to_async(verify_tick)()

    async def test_create_tick_unauthenticated(
        self, boulder_problem, graphql_query, graphql_context_anonymous
    ):
        """Test that creating a tick requires authentication"""
        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "date": "2024-01-15",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context_anonymous,
        )

        # GraphQL can return success=True even with errors
        # Check for errors in the result
        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "Authentication required" in error_messages
            or "authentication" in error_messages.lower()
        )

    async def test_create_tick_duplicate(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test that creating a duplicate tick fails"""
        # Create first tick
        await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "date": "2024-01-16",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert "already exists" in error_messages.lower()

    async def test_create_tick_optional_fields(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test creating a tick with only required fields"""
        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
                date
                notes
                tickGrade
                suggestedGrade
                rating
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "date": "2024-01-15",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert success is True
        assert result.get("data") is not None
        assert result["data"]["createTick"]["date"] == "2024-01-15"
        assert result["data"]["createTick"]["notes"] == ""
        assert result["data"]["createTick"]["tickGrade"] is None
        assert result["data"]["createTick"]["suggestedGrade"] is None
        assert result["data"]["createTick"]["rating"] is None

    async def test_update_tick_authenticated(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test updating a tick when authenticated"""
        # Create a tick first
        tick = await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
            notes="Original notes",
            rating=3.0,
        )

        mutation = """
        mutation UpdateTick($id: ID!, $input: UpdateTickInput!) {
            updateTick(id: $id, input: $input) {
                id
                date
                notes
                tickGrade
                suggestedGrade
                rating
            }
        }
        """
        variables = {
            "id": str(tick.id),
            "input": {
                "date": "2024-01-20",
                "notes": "Updated notes",
                "tickGrade": "7B",
                "suggestedGrade": "7B+",
                "rating": 4.5,
            },
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert success is True
        assert "errors" not in result or len(result.get("errors", [])) == 0
        assert result.get("data") is not None
        assert result["data"]["updateTick"]["date"] == "2024-01-20"
        assert result["data"]["updateTick"]["notes"] == "Updated notes"
        assert result["data"]["updateTick"]["tickGrade"] == "7B"
        assert result["data"]["updateTick"]["suggestedGrade"] == "7B+"
        assert result["data"]["updateTick"]["rating"] == 4.5

        # Verify tick was updated in database
        await sync_to_async(tick.refresh_from_db)()
        assert tick.date == date(2024, 1, 20)
        assert tick.notes == "Updated notes"
        assert tick.tick_grade == "7B"
        assert tick.suggested_grade == "7B+"
        assert tick.rating == 4.5

    async def test_update_tick_partial(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test updating only some fields of a tick"""
        tick = await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
            notes="Original notes",
            rating=3.0,
        )

        mutation = """
        mutation UpdateTick($id: ID!, $input: UpdateTickInput!) {
            updateTick(id: $id, input: $input) {
                id
                notes
                rating
            }
        }
        """
        variables = {
            "id": str(tick.id),
            "input": {
                "notes": "Only notes updated",
            },
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert success is True
        assert result.get("data") is not None
        assert result["data"]["updateTick"]["notes"] == "Only notes updated"
        # Rating should remain unchanged
        await sync_to_async(tick.refresh_from_db)()
        assert tick.rating == 3.0

    async def test_update_tick_unauthenticated(
        self, boulder_problem, user, graphql_query, graphql_context_anonymous
    ):
        """Test that updating a tick requires authentication"""
        tick = await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation UpdateTick($id: ID!, $input: UpdateTickInput!) {
            updateTick(id: $id, input: $input) {
                id
            }
        }
        """
        variables = {
            "id": str(tick.id),
            "input": {"notes": "Should fail"},
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context_anonymous,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "Authentication required" in error_messages
            or "authentication" in error_messages.lower()
        )

    async def test_update_tick_other_user(
        self, boulder_problem, user, multiple_users, graphql_query, graphql_context
    ):
        """Test that users can only update their own ticks"""
        other_user = multiple_users[0]
        tick = await sync_to_async(Tick.objects.create)(
            user=other_user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation UpdateTick($id: ID!, $input: UpdateTickInput!) {
            updateTick(id: $id, input: $input) {
                id
            }
        }
        """
        variables = {
            "id": str(tick.id),
            "input": {"notes": "Should fail"},
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "not found" in error_messages.lower()
            or "permission" in error_messages.lower()
        )

    async def test_delete_tick_authenticated(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test deleting a tick when authenticated"""
        tick = await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation DeleteTick($id: ID!) {
            deleteTick(id: $id)
        }
        """
        variables = {"id": str(tick.id)}

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert success is True
        assert result.get("data") is not None
        assert result["data"]["deleteTick"] is True

        # Verify tick was deleted
        exists = await sync_to_async(Tick.objects.filter(id=tick.id).exists)()
        assert not exists

    async def test_delete_tick_unauthenticated(
        self, boulder_problem, user, graphql_query, graphql_context_anonymous
    ):
        """Test that deleting a tick requires authentication"""
        tick = await sync_to_async(Tick.objects.create)(
            user=user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation DeleteTick($id: ID!) {
            deleteTick(id: $id)
        }
        """
        variables = {"id": str(tick.id)}

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context_anonymous,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "Authentication required" in error_messages
            or "authentication" in error_messages.lower()
        )

    async def test_delete_tick_other_user(
        self, boulder_problem, user, multiple_users, graphql_query, graphql_context
    ):
        """Test that users can only delete their own ticks"""
        other_user = multiple_users[0]
        tick = await sync_to_async(Tick.objects.create)(
            user=other_user,
            problem=boulder_problem,
            date=date(2024, 1, 15),
        )

        mutation = """
        mutation DeleteTick($id: ID!) {
            deleteTick(id: $id)
        }
        """
        variables = {"id": str(tick.id)}

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "not found" in error_messages.lower()
            or "permission" in error_messages.lower()
        )

    async def test_create_tick_problem_not_found(
        self, user, graphql_query, graphql_context
    ):
        """Test creating a tick for non-existent problem"""
        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": "999999",  # Use a non-existent integer ID
                "date": "2024-01-15",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert "not found" in error_messages.lower()
