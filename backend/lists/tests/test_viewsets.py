import pytest
from datetime import date
from rest_framework import status
from lists.models import Tick, UserList, ListEntry


@pytest.mark.django_db
class TestTickViewSet:

    def test_list_my_ticks_requires_auth(self, api_client):
        response = api_client.get("/api/ticks/my_ticks/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_my_ticks(self, authenticated_client, user, boulder_problem):
        tick = Tick.objects.create(
            user=user, problem=boulder_problem, date=date.today()
        )

        response = authenticated_client.get("/api/ticks/my_ticks/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["id"] == tick.id

    def test_create_tick(self, authenticated_client, user, boulder_problem):
        response = authenticated_client.post(
            "/api/ticks/",
            {
                "problem": boulder_problem.id,
                "date": str(date.today()),
                "notes": "Great problem!",
                "rating": 4.5,
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["problem"]["id"] == boulder_problem.pk
        assert response.data["notes"] == "Great problem!"
        assert float(response.data["rating"]) == 4.5

    def test_create_duplicate_tick(self, authenticated_client, user, boulder_problem):
        Tick.objects.create(user=user, problem=boulder_problem, date=date.today())

        response = authenticated_client.post(
            "/api/ticks/",
            {"problem": boulder_problem.id, "date": str(date.today())},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already ticked" in str(response.data).lower()

    def test_get_problem_ticks(self, api_client, user, boulder_problem, multiple_users):
        # Create ticks from multiple users
        for i, other_user in enumerate(multiple_users[:3]):
            Tick.objects.create(
                user=other_user,
                problem=boulder_problem,
                date=date.today(),
            )

        response = api_client.get(
            f"/api/ticks/problem_ticks/?problem={boulder_problem.id}"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_get_user_diary(self, api_client, user, multiple_problems):
        # Create ticks for the user
        for problem in multiple_problems[:3]:
            Tick.objects.create(user=user, problem=problem, date=date.today())

        response = api_client.get(f"/api/ticks/user_diary/?user={user.id}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_get_recent_ticks(self, api_client, multiple_users, multiple_problems):
        # Create ticks from multiple users
        for i, user in enumerate(multiple_users[:3]):
            Tick.objects.create(
                user=user,
                problem=multiple_problems[i],
                date=date.today(),
            )

        response = api_client.get("/api/ticks/recent/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 3

    def test_get_community_stats(
        self, api_client, area, multiple_problems, multiple_users
    ):
        # Create some ticks
        for i, user in enumerate(multiple_users[:3]):
            Tick.objects.create(
                user=user,
                problem=multiple_problems[i],
                date=date.today(),
            )

        response = api_client.get("/api/ticks/community_stats/")
        assert response.status_code == status.HTTP_200_OK
        assert "total_problems" in response.data
        assert "total_ticks" in response.data
        assert "active_climbers" in response.data
        assert response.data["total_ticks"] == 3
        assert response.data["active_climbers"] == 3


@pytest.mark.django_db
class TestUserListViewSet:

    def test_list_my_lists_requires_auth(self, api_client):
        response = api_client.get("/api/lists/")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_my_lists(self, authenticated_client, user):
        UserList.objects.create(user=user, name="My List")

        response = authenticated_client.get("/api/lists/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == "My List"

    def test_create_list(self, authenticated_client, user):
        response = authenticated_client.post(
            "/api/lists/",
            {
                "name": "My Projects",
                "description": "Problems I want to climb",
                "is_public": False,
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "My Projects"
        assert response.data["user"]["id"] == user.id

    def test_add_problem_to_list(self, authenticated_client, user, boulder_problem):
        user_list = UserList.objects.create(user=user, name="My List")

        response = authenticated_client.post(
            f"/api/lists/{user_list.id}/add_problem/",
            {"problem": boulder_problem.id, "notes": "Want to try this"},
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert ListEntry.objects.filter(
            user_list=user_list, problem=boulder_problem
        ).exists()

    def test_remove_problem_from_list(
        self, authenticated_client, user, boulder_problem
    ):
        user_list = UserList.objects.create(user=user, name="My List")
        ListEntry.objects.create(user_list=user_list, problem=boulder_problem)

        response = authenticated_client.delete(
            f"/api/lists/{user_list.id}/remove_problem/",
            {"problem": boulder_problem.id},
            format="json",
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert not ListEntry.objects.filter(
            user_list=user_list, problem=boulder_problem
        ).exists()
