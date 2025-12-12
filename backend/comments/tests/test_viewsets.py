import pytest
from rest_framework import status
from comments.models import Comment
from datetime import timedelta
from django.utils import timezone


@pytest.mark.django_db
class TestCommentViewSet:

    def test_list_comments(self, api_client, user, boulder_problem):
        Comment.objects.create(
            problem=boulder_problem, user=user, content="Test comment"
        )

        response = api_client.get("/api/comments/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["content"] == "Test comment"

    def test_filter_comments_by_problem(self, api_client, user, multiple_problems):
        comment1 = Comment.objects.create(
            problem=multiple_problems[0], user=user, content="Comment 1"
        )
        Comment.objects.create(
            problem=multiple_problems[1], user=user, content="Comment 2"
        )

        response = api_client.get(f"/api/comments/?problem={multiple_problems[0].id}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["id"] == comment1.id

    def test_create_comment_requires_auth(self, api_client, boulder_problem):
        response = api_client.post(
            "/api/comments/",
            {"problem": boulder_problem.id, "content": "Test comment"},
        )
        # IsAuthenticatedOrReadOnly returns 403 Forbidden (not 401) for unauthenticated write operations
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_comment_authenticated(
        self, authenticated_client, user, boulder_problem
    ):
        response = authenticated_client.post(
            "/api/comments/",
            {"problem": boulder_problem.id, "content": "Test comment"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["content"] == "Test comment"
        assert response.data["user"]["id"] == user.id
        assert response.data["problem"] == boulder_problem.id

    def test_update_own_comment(self, authenticated_client, user, boulder_problem):
        comment = Comment.objects.create(
            problem=boulder_problem, user=user, content="Original comment"
        )

        response = authenticated_client.patch(
            f"/api/comments/{comment.id}/",
            {"content": "Updated comment"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["content"] == "Updated comment"
        assert response.data["edited"] is True

    def test_delete_own_comment(self, authenticated_client, user, boulder_problem):
        comment = Comment.objects.create(
            problem=boulder_problem, user=user, content="Test comment"
        )

        response = authenticated_client.delete(f"/api/comments/{comment.id}/")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not Comment.objects.filter(id=comment.id).exists()

    def test_comment_ordering(self, api_client, user, boulder_problem):

        old_comment = Comment.objects.create(
            problem=boulder_problem, user=user, content="Old comment"
        )
        old_comment.created_at = timezone.now() - timedelta(days=1)
        old_comment.save()

        new_comment = Comment.objects.create(
            problem=boulder_problem, user=user, content="New comment"
        )

        response = api_client.get(f"/api/comments/?problem={boulder_problem.id}")
        assert response.status_code == status.HTTP_200_OK
        comments = response.data["results"]
        assert comments[0]["id"] == new_comment.id
        assert comments[1]["id"] == old_comment.id
