import pytest
from django.db import IntegrityError
from django.core.exceptions import ValidationError
from boulders.models import Area, Sector, Wall, BoulderProblem


@pytest.mark.django_db
class TestCity:
    def test_city_area_count_property(self, city, area):
        assert city.area_count == 1

    def test_city_crag_count_property(self, city, area):
        assert city.crag_count == 1
        assert city.crag_count == city.area_count


@pytest.mark.django_db
class TestArea:
    def test_area_problem_count_property(self, area, boulder_problem):
        assert area.problem_count == 1

    def test_area_sector_count_property(self, area, sector):
        assert area.sector_count == 1

    def test_secret_area_business_logic(self, city):
        secret_area = Area.objects.create(city=city, name="Secret Area", is_secret=True)
        public_area = Area.objects.create(
            city=city, name="Public Area", is_secret=False
        )

        assert secret_area.is_secret is True
        assert public_area.is_secret is False


@pytest.mark.django_db
class TestSector:
    def test_sector_str_includes_area(self, area):
        sector = Sector.objects.create(
            area=area,
            name="Test Sector",
            latitude=49.123456,
            longitude=16.654321,
        )
        assert str(sector) == f"{area.name} - Test Sector"

    def test_sector_unique_together_constraint(self, area):
        Sector.objects.create(
            area=area,
            name="Duplicate Sector",
            latitude=49.123456,
            longitude=16.654321,
        )

        with pytest.raises(IntegrityError):
            Sector.objects.create(
                area=area,
                name="Duplicate Sector",
                latitude=49.123457,
                longitude=16.654322,
            )


@pytest.mark.django_db
class TestWall:
    def test_wall_str_includes_sector_and_area(self, sector):
        wall = Wall.objects.create(sector=sector, name="Test Wall")
        expected = f"{sector.area.name} - {sector.name} - Test Wall"
        assert str(wall) == expected

    def test_wall_problem_count_property(self, wall, boulder_problem):
        assert wall.problem_count == 1

    def test_wall_unique_together_constraint(self, sector):
        Wall.objects.create(sector=sector, name="Duplicate Wall")

        with pytest.raises(IntegrityError):
            Wall.objects.create(sector=sector, name="Duplicate Wall")


@pytest.mark.django_db
class TestBoulderProblem:
    def test_boulder_problem_unique_together_constraint(self, area, sector, wall, user):
        BoulderProblem.objects.create(
            area=area,
            sector=sector,
            wall=wall,
            name="Duplicate Problem",
            grade="7A",
            created_by=user,
        )

        with pytest.raises(ValidationError) as exc_info:
            BoulderProblem.objects.create(
                area=area,
                sector=sector,
                wall=wall,
                name="Duplicate Problem",  # Same name in same area
                grade="7B",
                created_by=user,
            )

        assert "__all__" in exc_info.value.error_dict
        assert "already exists" in str(exc_info.value).lower()

    def test_boulder_problem_same_name_different_area_allowed(
        self, area, sector, wall, user, city
    ):
        problem1 = BoulderProblem.objects.create(
            area=area,
            sector=sector,
            wall=wall,
            name="Same Name Problem",
            grade="7A",
            created_by=user,
        )

        other_area = Area.objects.create(
            city=city,
            name="Other Area",
            created_by=user,
        )
        other_sector = Sector.objects.create(
            area=other_area,
            name="Other Sector",
            latitude=49.123456,
            longitude=16.654321,
            created_by=user,
        )
        other_wall = Wall.objects.create(
            sector=other_sector,
            name="Other Wall",
            created_by=user,
        )

        problem2 = BoulderProblem.objects.create(
            area=other_area,
            sector=other_sector,
            wall=other_wall,
            name="Same Name Problem",  # Same name, different area
            grade="7B",
            created_by=user,
        )

        assert problem1.name == problem2.name
        assert problem1.area != problem2.area
