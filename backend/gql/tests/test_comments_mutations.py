import pytest
from comments.models import Comment
from asgiref.sync import sync_to_async


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestCommentMutations:
    """Test GraphQL comment mutations"""

    async def test_create_comment_authenticated(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test creating a comment when authenticated"""
        mutation = """
        mutation CreateComment($input: CreateCommentInput!) {
            createComment(input: $input) {
                id
                content
                user {
                    username
                }
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "content": "This is a test comment",
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
        assert result["data"]["createComment"]["content"] == "This is a test comment"
        assert result["data"]["createComment"]["user"]["username"] == user.username

        # Verify comment was created in database

        comment_id = result["data"]["createComment"]["id"]
        # Convert string ID to int if needed
        if isinstance(comment_id, str):
            comment_id = int(comment_id)

        def get_comment():
            return Comment.objects.select_related("user", "problem").get(id=comment_id)

        comment = await sync_to_async(get_comment)()

        def verify_comment():
            assert comment.content == "This is a test comment"
            assert comment.user.id == user.id
            assert comment.problem.id == boulder_problem.id

        await sync_to_async(verify_comment)()

    async def test_create_comment_unauthenticated(
        self, boulder_problem, graphql_query, graphql_context_anonymous
    ):
        """Test that creating a comment requires authentication"""
        mutation = """
        mutation CreateComment($input: CreateCommentInput!) {
            createComment(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "content": "This should fail",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context_anonymous,
        )

        # GraphQL mutations can return errors but still have success=True
        # Check for errors in the result
        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert (
            "Authentication required" in error_messages
            or "authentication" in error_messages.lower()
        )

    async def test_create_comment_empty_content(
        self, boulder_problem, user, graphql_query, graphql_context
    ):
        """Test that empty comment content is rejected"""
        mutation = """
        mutation CreateComment($input: CreateCommentInput!) {
            createComment(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": str(boulder_problem.id),
                "content": "   ",
            }
        }

        success, result = await graphql_query(
            mutation,
            variables=variables,
            context_value=graphql_context,
        )

        assert "errors" in result and len(result["errors"]) > 0
        error_messages = " ".join([e.get("message", "") for e in result["errors"]])
        assert "empty" in error_messages.lower()

    async def test_create_comment_problem_not_found(
        self, user, graphql_query, graphql_context
    ):
        """Test creating a comment for non-existent problem"""
        mutation = """
        mutation CreateComment($input: CreateCommentInput!) {
            createComment(input: $input) {
                id
            }
        }
        """
        variables = {
            "input": {
                "problemId": "999999",  # Use a non-existent integer ID
                "content": "This should fail",
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
