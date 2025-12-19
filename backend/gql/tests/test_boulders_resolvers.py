import pytest
from gql.boulders.resolvers import (
    resolve_wall_problem_count,
)
from boulders.models import BoulderProblem, Sector, Wall
from asgiref.sync import sync_to_async
from unittest.mock import Mock


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestQueryResolvers:
    """Test GraphQL query resolvers"""

    async def test_resolve_problem(self, boulder_problem, graphql_query):
        """Test resolving a single problem"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                name
                grade
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        if "errors" in result:
            print(f"GraphQL errors: {result['errors']}")
        assert "errors" not in result or len(result.get("errors", [])) == 0
        assert result.get("data") is not None
        assert result["data"]["problem"] is not None
        assert result["data"]["problem"]["id"] == str(boulder_problem.id)
        assert result["data"]["problem"]["name"] == boulder_problem.name
        assert result["data"]["problem"]["grade"] == boulder_problem.grade

    async def test_resolve_problem_not_found(self, graphql_query):
        """Test resolving a non-existent problem"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": "00000000-0000-0000-0000-000000000000"},
        )
        assert success is True
        assert result["data"]["problem"] is None

    async def test_resolve_problem_secret_area(self, secret_area, user, graphql_query):
        """Test that problems in secret areas are not returned"""

        # Create sector and wall in secret area
        secret_sector = await sync_to_async(Sector.objects.create)(
            area=secret_area,
            name="Secret Sector",
            latitude=49.0,
            longitude=16.0,
        )
        secret_wall = await sync_to_async(Wall.objects.create)(
            sector=secret_sector,
            name="Secret Wall",
        )

        problem = await sync_to_async(BoulderProblem.objects.create)(
            area=secret_area,
            sector=secret_sector,
            wall=secret_wall,
            name="Secret Problem",
            grade="7A",
            created_by=user,
        )

        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        # Should return None for secret areas
        assert result["data"]["problem"] is None

    async def test_resolve_problems(self, multiple_problems, graphql_query):
        """Test resolving multiple problems"""
        query = """
        query GetProblems {
            problems {
                id
                name
                grade
            }
        }
        """
        success, result = await graphql_query(query)
        assert success is True
        # if "errors" in result:
        #     print(f"GraphQL errors: {result['errors']}")
        assert "errors" not in result or len(result.get("errors", [])) == 0
        assert result.get("data") is not None
        assert len(result["data"]["problems"]) == len(multiple_problems)

    async def test_resolve_problems_with_area_filter(
        self, area, multiple_problems, graphql_query
    ):
        """Test filtering problems by area"""
        query = """
        query GetProblems($areaId: ID) {
            problems(areaId: $areaId) {
                id
                name
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"areaId": str(area.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["problems"]) == len(multiple_problems)

    async def test_resolve_problems_with_search(self, multiple_problems, graphql_query):
        """Test searching problems"""
        query = """
        query GetProblems($search: String) {
            problems(search: $search) {
                id
                name
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"search": "Problem 1"},
        )
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["problems"]) >= 1
        assert any("Problem 1" in p["name"] for p in result["data"]["problems"])

    async def test_resolve_area(self, area, graphql_query):
        """Test resolving a single area"""
        query = """
        query GetArea($id: ID!) {
            area(id: $id) {
                id
                name
                description
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(area.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["area"]["id"] == str(area.id)
        assert result["data"]["area"]["name"] == area.name

    async def test_resolve_area_secret(self, secret_area, graphql_query):
        """Test that secret areas are not returned"""
        query = """
        query GetArea($id: ID!) {
            area(id: $id) {
                id
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(secret_area.id)},
        )
        assert success is True
        assert result["data"]["area"] is None

    async def test_resolve_areas(self, area, city, graphql_query):
        """Test resolving multiple areas"""
        query = """
        query GetAreas {
            areas {
                id
                name
            }
        }
        """
        success, result = await graphql_query(query)
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["areas"]) >= 1
        area_ids = [a["id"] for a in result["data"]["areas"]]
        assert str(area.id) in area_ids

    async def test_resolve_areas_with_city_filter(self, area, city, graphql_query):
        """Test filtering areas by city"""
        query = """
        query GetAreas($cityId: ID) {
            areas(cityId: $cityId) {
                id
                name
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"cityId": str(city.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["areas"]) >= 1

    async def test_resolve_sector(self, sector, graphql_query):
        """Test resolving a single sector"""
        query = """
        query GetSector($id: ID!) {
            sector(id: $id) {
                id
                name
                latitude
                longitude
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(sector.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["sector"]["id"] == str(sector.id)
        assert result["data"]["sector"]["name"] == sector.name

    async def test_resolve_sector_secret(self, secret_area, sector, graphql_query):
        """Test that sectors in secret areas are not returned"""

        sector.area = secret_area
        await sync_to_async(sector.save)()

        query = """
        query GetSector($id: ID!) {
            sector(id: $id) {
                id
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(sector.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["sector"] is None

    async def test_resolve_sectors(self, sector, area, graphql_query):
        """Test resolving multiple sectors"""
        query = """
        query GetSectors {
            sectors {
                id
                name
            }
        }
        """
        success, result = await graphql_query(query)
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["sectors"]) >= 1

    async def test_resolve_sectors_with_area_filter(self, sector, area, graphql_query):
        """Test filtering sectors by area"""
        query = """
        query GetSectors($areaId: ID) {
            sectors(areaId: $areaId) {
                id
                name
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"areaId": str(area.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert len(result["data"]["sectors"]) >= 1


@pytest.mark.django_db(transaction=True)
@pytest.mark.asyncio
class TestFieldResolvers:
    """Test GraphQL field resolvers"""

    async def test_resolve_statistics(
        self, boulder_problem, multiple_ticks, graphql_query
    ):
        """Test resolving problem statistics"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                statistics {
                    totalTicks
                    heightDataCount
                    gradeVotesCount
                }
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        stats = result["data"]["problem"]["statistics"]
        assert stats["totalTicks"] == len(multiple_ticks)
        assert stats["heightDataCount"] >= 0
        assert stats["gradeVotesCount"] >= 0

    async def test_resolve_comments(
        self, boulder_problem, multiple_comments, graphql_query
    ):
        """Test resolving problem comments"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                comments {
                    id
                    content
                    user {
                        username
                    }
                }
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        comments = result["data"]["problem"]["comments"]
        assert len(comments) == len(multiple_comments)

    async def test_resolve_ticks(self, boulder_problem, multiple_ticks, graphql_query):
        """Test resolving problem ticks"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                ticks {
                    id
                    date
                    notes
                    tickGrade
                    suggestedGrade
                    rating
                }
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        ticks = result["data"]["problem"]["ticks"]
        assert len(ticks) == len(multiple_ticks)

    async def test_resolve_tick_count(
        self, boulder_problem, multiple_ticks, graphql_query
    ):
        """Test resolving tick count"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                tickCount
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["problem"]["tickCount"] == len(multiple_ticks)

    async def test_resolve_avg_rating(
        self, boulder_problem, multiple_ticks, graphql_query
    ):
        """Test resolving average rating"""
        query = """
        query GetProblem($id: ID!) {
            problem(id: $id) {
                id
                avgRating
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(boulder_problem.id)},
        )
        assert success is True
        assert result.get("data") is not None
        # Should have a rating if ticks have ratings
        if any(tick.rating for tick in multiple_ticks):
            assert result["data"]["problem"]["avgRating"] is not None
            assert isinstance(result["data"]["problem"]["avgRating"], (int, float))

    async def test_resolve_area_problem_count(
        self, area, multiple_problems, graphql_query
    ):
        """Test resolving area problem count"""
        query = """
        query GetArea($id: ID!) {
            area(id: $id) {
                id
                problemCount
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(area.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["area"]["problemCount"] == len(multiple_problems)

    async def test_resolve_sector_problem_count(
        self, sector, multiple_problems, graphql_query
    ):
        """Test resolving sector problem count"""
        query = """
        query GetSector($id: ID!) {
            sector(id: $id) {
                id
                problemCount
            }
        }
        """
        success, result = await graphql_query(
            query,
            variables={"id": str(sector.id)},
        )
        assert success is True
        assert result.get("data") is not None
        assert result["data"]["sector"]["problemCount"] == len(multiple_problems)

    async def test_resolve_wall_problem_count(self, wall, multiple_problems):
        """Test resolving wall problem count"""
        mock_info = Mock()
        count = await resolve_wall_problem_count(wall, mock_info)
        assert count == len(multiple_problems)
