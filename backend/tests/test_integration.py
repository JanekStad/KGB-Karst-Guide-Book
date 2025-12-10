import pytest
from datetime import date
from rest_framework import status
from django.contrib.auth.models import User
from boulders.models import City, Area, Sector, Wall, BoulderProblem
from comments.models import Comment
from lists.models import Tick, UserList


@pytest.mark.django_db
@pytest.mark.integration
class TestUserRegistrationFlow:

    def test_complete_registration_flow(self, api_client):
        # Register user
        register_response = api_client.post(
            "/api/users/register/",
            {
                "username": "newclimber",
                "email": "climber@example.com",
                "password": "securepass123",
                "password_confirm": "securepass123",
                "height": "170-175",
                "ape_index": "2.5",
            },
        )
        assert register_response.status_code == status.HTTP_201_CREATED
        token = register_response.data["token"]
        user_id = register_response.data["user"]["id"]

        # Verify profile was created
        user = User.objects.get(id=user_id)
        assert user.profile.height == "170-175"
        assert float(user.profile.ape_index) == 2.5

        # Login with token
        api_client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        me_response = api_client.get("/api/users/me/")
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.data["username"] == "newclimber"


@pytest.mark.django_db
@pytest.mark.integration
class TestTickCreationFlow:

    def test_complete_tick_flow(self, authenticated_client, user, boulder_problem):
        # Create tick
        tick_response = authenticated_client.post(
            "/api/ticks/",
            {
                "problem": boulder_problem.id,
                "date": str(date.today()),
                "notes": "Great send!",
                "rating": 5.0,
                "tick_grade": "7A",
            },
        )
        assert tick_response.status_code == status.HTTP_201_CREATED
        tick_id = tick_response.data["id"]

        # View own ticks
        my_ticks_response = authenticated_client.get("/api/ticks/my_ticks/")
        assert my_ticks_response.status_code == status.HTTP_200_OK
        assert len(my_ticks_response.data) == 1
        assert my_ticks_response.data[0]["id"] == tick_id

        # View problem ticks (public)
        problem_ticks_response = authenticated_client.get(
            f"/api/ticks/problem_ticks/?problem={boulder_problem.id}"
        )
        assert problem_ticks_response.status_code == status.HTTP_200_OK
        assert len(problem_ticks_response.data) == 1


@pytest.mark.django_db
@pytest.mark.integration
class TestCommentFlow:

    def test_complete_comment_flow(self, authenticated_client, user, boulder_problem):
        # Create comment
        create_response = authenticated_client.post(
            "/api/comments/",
            {"problem": boulder_problem.id, "content": "Great problem!"},
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        comment_id = create_response.data["id"]

        # Update comment
        update_response = authenticated_client.patch(
            f"/api/comments/{comment_id}/",
            {"content": "Updated: Great problem!"},
        )
        assert update_response.status_code == status.HTTP_200_OK
        assert update_response.data["edited"] is True

        # View comments for problem
        list_response = authenticated_client.get(
            f"/api/comments/?problem={boulder_problem.id}"
        )
        assert list_response.status_code == status.HTTP_200_OK
        assert len(list_response.data["results"]) == 1

        # Delete comment
        delete_response = authenticated_client.delete(f"/api/comments/{comment_id}/")
        assert delete_response.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
@pytest.mark.integration
class TestProblemCreationFlow:

    def test_complete_problem_creation_flow(
        self, authenticated_client, user, city, area, sector, wall
    ):
        # Create problem
        create_response = authenticated_client.post(
            "/api/problems/",
            {
                "area": area.id,
                "sector": sector.id,
                "wall": wall.id,
                "name": "New Test Problem",
                "grade": "7B",
                "description": "A challenging problem",
                "latitude": 49.123456,
                "longitude": 16.654321,
            },
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        problem_id = create_response.data["id"]

        # View problem
        view_response = authenticated_client.get(f"/api/problems/{problem_id}/")
        assert view_response.status_code == status.HTTP_200_OK
        assert view_response.data["name"] == "New Test Problem"
        assert view_response.data["grade"] == "7B"

        # Verify problem appears in area problems
        area_problems_response = authenticated_client.get(
            f"/api/areas/{area.id}/problems/"
        )
        assert area_problems_response.status_code == status.HTTP_200_OK
        problem_names = [p["name"] for p in area_problems_response.data]
        assert "New Test Problem" in problem_names


@pytest.mark.django_db
@pytest.mark.integration
class TestListManagementFlow:

    def test_complete_list_flow(
        self, authenticated_client, user, boulder_problem, multiple_problems
    ):
        # Create list
        create_response = authenticated_client.post(
            "/api/lists/",
            {
                "name": "My Projects",
                "description": "Problems I want to climb",
                "is_public": False,
            },
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        list_id = create_response.data["id"]

        # Add problems to list
        for problem in multiple_problems[:3]:
            add_response = authenticated_client.post(
                f"/api/lists/{list_id}/add_problem/",
                {"problem": problem.id, "notes": f"Want to try {problem.name}"},
            )
            assert add_response.status_code == status.HTTP_201_CREATED

        # View list
        view_response = authenticated_client.get(f"/api/lists/{list_id}/")
        assert view_response.status_code == status.HTTP_200_OK
        assert len(view_response.data["problems"]) == 3

        # Remove a problem
        remove_response = authenticated_client.delete(
            f"/api/lists/{list_id}/remove_problem/",
            {"problem": multiple_problems[0].id},
            format="json",
        )
        assert remove_response.status_code == status.HTTP_200_OK

        # Verify problem was removed
        view_response = authenticated_client.get(f"/api/lists/{list_id}/")
        assert len(view_response.data["problems"]) == 2
