import pytest
from django.contrib.auth.models import User
from rest_framework import status
from boulders.models import City, Area, Sector, Wall, BoulderProblem


@pytest.mark.django_db
class TestCityViewSet:

    def test_list_cities(self, api_client, city):
        response = api_client.get("/api/cities/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == city.name

    def test_retrieve_city(self, api_client, city):
        response = api_client.get(f"/api/cities/{city.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == city.name

    # def test_create_city_requires_auth(self, api_client):
    #     """Test that creating a city requires authentication"""
    #     response = api_client.post(
    #         "/api/cities/", {"name": "New City", "description": "Test"}
    #     )
    #     assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_city_authenticated(self, authenticated_client, user):
        response = authenticated_client.post(
            "/api/cities/", {"name": "New City", "description": "Test"}
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "New City"
        assert response.data["created_by"] == user.id

    def test_get_city_areas(self, api_client, city, area):
        response = api_client.get(f"/api/cities/{city.id}/areas/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == area.name

    def test_get_city_crags_alias(self, api_client, city, area):
        response = api_client.get(f"/api/cities/{city.id}/crags/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1


@pytest.mark.django_db
class TestAreaViewSet:

    def test_list_areas(self, api_client, area):
        response = api_client.get("/api/areas/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == area.name

    def test_list_areas_excludes_secret(self, api_client, area, secret_area):
        response = api_client.get("/api/areas/")
        assert response.status_code == status.HTTP_200_OK
        area_names = [a["name"] for a in response.data["results"]]
        assert area.name in area_names
        assert secret_area.name not in area_names

    def test_retrieve_area(self, api_client, area):
        response = api_client.get(f"/api/areas/{area.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == area.name

    def test_get_area_problems(self, api_client, area, boulder_problem):
        response = api_client.get(f"/api/areas/{area.id}/problems/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data) == 1
        assert response.data[0]["name"] == boulder_problem.name

    def test_search_areas(self, api_client, area):
        response = api_client.get("/api/areas/?search=Test")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1


@pytest.mark.django_db
class TestBoulderProblemViewSet:

    def test_list_problems(self, api_client, boulder_problem):
        response = api_client.get("/api/problems/")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["name"] == boulder_problem.name

    def test_list_problems_excludes_secret_areas(
        self, api_client, boulder_problem, secret_area, user
    ):
        # Create sector and wall that belong to secret_area
        secret_sector = Sector.objects.create(
            area=secret_area,
            name="Secret Sector",
            description="A secret sector",
            latitude=49.123456,
            longitude=16.654321,
            is_secret=False,
        )
        secret_wall = Wall.objects.create(
            sector=secret_sector,
            name="Secret Wall",
            description="A secret wall",
        )
        secret_problem = BoulderProblem.objects.create(
            area=secret_area,
            sector=secret_sector,
            wall=secret_wall,
            name="Secret Problem",
            grade="7A",
            created_by=user,
        )
        response = api_client.get("/api/problems/")
        assert response.status_code == status.HTTP_200_OK
        problem_names = [p["name"] for p in response.data["results"]]
        assert boulder_problem.name in problem_names
        assert secret_problem.name not in problem_names

    def test_retrieve_problem(self, api_client, boulder_problem):
        response = api_client.get(f"/api/problems/{boulder_problem.id}/")
        assert response.status_code == status.HTTP_200_OK
        assert response.data["name"] == boulder_problem.name
        assert response.data["grade"] == boulder_problem.grade

    def test_filter_problems_by_area(self, api_client, area, multiple_problems):
        response = api_client.get(f"/api/problems/?area={area.id}")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) == len(multiple_problems)

    def test_filter_problems_by_grade(self, api_client, multiple_problems):
        response = api_client.get("/api/problems/?grade=7A")
        assert response.status_code == status.HTTP_200_OK
        assert all(p["grade"] == "7A" for p in response.data["results"])

    def test_search_problems(self, api_client, boulder_problem):
        response = api_client.get("/api/problems/?search=Test")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["results"]) >= 1

    def test_create_problem_requires_auth(self, api_client, area, sector, wall):
        response = api_client.post(
            "/api/problems/",
            {
                "area": area.id,
                "sector": sector.id,
                "wall": wall.id,
                "name": "New Problem",
                "grade": "7A",
            },
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_problem_authenticated(
        self, authenticated_client, area, sector, wall, user
    ):
        response = authenticated_client.post(
            "/api/problems/",
            {
                "area": area.id,
                "sector": sector.id,
                "wall": wall.id,
                "name": "New Problem",
                "grade": "7A",
            },
        )
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "New Problem"
        assert response.data["created_by"] == user.id

    def test_get_problem_statistics(
        self, api_client, boulder_problem, user_with_profile
    ):
        from lists.models import Tick
        from datetime import date

        # Create a tick for the problem
        Tick.objects.create(
            user=user_with_profile,
            problem=boulder_problem,
            date=date.today(),
        )

        response = api_client.get(f"/api/problems/{boulder_problem.id}/statistics/")
        assert response.status_code == status.HTTP_200_OK
        assert "height_distribution" in response.data
        assert "grade_voting" in response.data
