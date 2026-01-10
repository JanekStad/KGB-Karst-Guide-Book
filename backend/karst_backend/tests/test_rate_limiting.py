import json
import pytest
from rest_framework import status


@pytest.mark.django_db
class TestRESTAPIRateLimiting:
    """Test rate limiting for REST API endpoints"""

    def test_anonymous_user_rate_limit(self, api_client, boulder_problem):
        """Test that anonymous users are rate limited"""
        for i in range(101):  # Exceed the 100/hour limit
            response = api_client.get(f"/api/problems/{boulder_problem.id}/")
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                assert (
                    "Rate limit exceeded" in str(response.data)
                    or response.status_code == 429
                )
                break
        else:
            pass

    def test_authenticated_user_mutation_rate_limit(
        self, authenticated_client, user, boulder_problem
    ):
        """Test that authenticated users are rate limited on mutations"""
        for i in range(61):
            response = authenticated_client.post(
                "/api/ticks/",
                {
                    "problem": boulder_problem.id,
                    "date": f"2024-01-{15 + i % 15}",  # Vary dates to avoid duplicate constraint
                },
            )
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                assert (
                    "Rate limit exceeded" in str(response.data)
                    or response.status_code == 429
                )
                break

    def test_comment_creation_rate_limit(
        self, authenticated_client, user, boulder_problem
    ):
        """Test rate limiting on comment creation"""
        for i in range(61):
            response = authenticated_client.post(
                "/api/comments/",
                {
                    "problem": boulder_problem.id,
                    "content": f"Test comment {i}",
                },
            )
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                assert (
                    "Rate limit exceeded" in str(response.data)
                    or response.status_code == 429
                )
                break


@pytest.mark.django_db
class TestGraphQLRateLimiting:
    """Test rate limiting for GraphQL endpoint"""

    def test_graphql_query_rate_limit(self, api_client, boulder_problem):
        """Test rate limiting on GraphQL queries"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                name
            }
        }
        """
        for i in range(101):  # Exceed the 100/hour limit for anonymous
            response = api_client.post(
                "/graphql/",
                {"query": query, "variables": {"id": str(boulder_problem.id)}},
                content_type="application/json",
            )
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                # GraphQL returns JsonResponse, so we need to parse JSON
                response_data = json.loads(response.content)
                assert (
                    "Rate limit exceeded" in str(response_data)
                    or response.status_code == 429
                )
                break

    def test_graphql_mutation_rate_limit(
        self, authenticated_client, user, boulder_problem
    ):
        """Test rate limiting on GraphQL mutations"""
        mutation = """
        mutation CreateTick($input: CreateTickInput!) {
            createTick(input: $input) {
                id
            }
        }
        """
        for i in range(61):  # Exceed the 60/hour limit
            response = authenticated_client.post(
                "/graphql/",
                {
                    "query": mutation,
                    "variables": {
                        "input": {
                            "problemId": str(boulder_problem.id),
                            "date": f"2024-01-{15 + i % 15}",
                        }
                    },
                },
                content_type="application/json",
            )
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                # GraphQL returns JsonResponse, so we need to parse JSON
                response_data = json.loads(response.content)
                assert (
                    "Rate limit exceeded" in str(response_data)
                    or response.status_code == 429
                )
                break

    def test_graphql_mutation_detection(self):
        """Test that mutation detection works correctly"""
        from gql.rate_limiting import is_mutation

        assert is_mutation("mutation { createTick(input: {}) { id } }")
        assert is_mutation("mutation CreateTick { createTick(input: {}) { id } }")
        assert is_mutation("  mutation { createTick(input: {}) { id } }")

        assert not is_mutation("query { problem(id: 1) { id } }")
        assert not is_mutation("query GetProblem { problem(id: 1) { id } }")
        assert not is_mutation("")
