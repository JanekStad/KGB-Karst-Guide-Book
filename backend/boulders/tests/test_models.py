import pytest
from django.db import IntegrityError
from django.core.exceptions import ValidationError
from boulders.models import City, Area, Sector, Wall, BoulderProblem


@pytest.mark.django_db
class TestCity:
    def test_city_area_count_property(self, city, area):
        assert city.area_count == 1

    def test_city_crag_count_property(self, city, area):
        assert city.crag_count == 1
        assert city.crag_count == city.area_count

    def test_city_name_normalized_on_create(self):
        """Test that name_normalized is automatically set when creating a city"""
        city = City.objects.create(name="Praha")
        assert city.name_normalized == "praha"
        assert city.name == "Praha"

    def test_city_name_normalized_with_diacritics(self):
        """Test that name_normalized removes diacritics"""
        city = City.objects.create(name="Brno")
        assert city.name_normalized == "brno"

        city2 = City.objects.create(name="České Budějovice")
        assert city2.name_normalized == "ceske budejovice"

    def test_city_name_normalized_on_save(self):
        """Test that name_normalized is updated when name changes"""
        city = City.objects.create(name="Praha")
        assert city.name_normalized == "praha"

        city.name = "Brno"
        city.save()
        assert city.name_normalized == "brno"

    def test_city_find_by_normalized_name_exact(self):
        """Test finding city by normalized name with exact match"""
        city = City.objects.create(name="Praha")
        results = City.find_by_normalized_name("praha")
        assert city in results
        assert results.count() == 1

    def test_city_find_by_normalized_name_case_insensitive(self):
        """Test that find_by_normalized_name is case-insensitive"""
        city = City.objects.create(name="Praha")
        results = City.find_by_normalized_name("PRAHA")
        assert city in results
        assert results.count() == 1

    def test_city_find_by_normalized_name_diacritic_insensitive(self):
        """Test that find_by_normalized_name is diacritic-insensitive"""
        city = City.objects.create(name="České Budějovice")
        results = City.find_by_normalized_name("ceske budejovice")
        assert city in results
        assert results.count() == 1

        # Also test reverse - search with diacritics
        results2 = City.find_by_normalized_name("České Budějovice")
        assert city in results2
        assert results2.count() == 1


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

    def test_area_name_normalized_on_create(self, city):
        """Test that name_normalized is automatically set when creating an area"""
        area = Area.objects.create(city=city, name="Sloup")
        assert area.name_normalized == "sloup"
        assert area.name == "Sloup"

    def test_area_name_normalized_with_diacritics(self, city):
        """Test that name_normalized removes diacritics"""
        area = Area.objects.create(city=city, name="Holštejn")
        assert area.name_normalized == "holstejn"

    def test_area_name_normalized_on_save(self, city):
        """Test that name_normalized is updated when name changes"""
        area = Area.objects.create(city=city, name="Sloup")
        assert area.name_normalized == "sloup"

        area.name = "Rudice"
        area.save()
        assert area.name_normalized == "rudice"

    def test_area_find_by_normalized_name(self, city):
        """Test finding area by normalized name"""
        area = Area.objects.create(city=city, name="Sloup")
        results = Area.find_by_normalized_name("sloup")
        assert area in results
        assert results.count() == 1

        # Case-insensitive
        results2 = Area.find_by_normalized_name("SLOUP")
        assert area in results2

        # Diacritic-insensitive
        area2 = Area.objects.create(city=city, name="Holštejn")
        results3 = Area.find_by_normalized_name("holstejn")
        assert area2 in results3


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

    def test_sector_name_normalized_on_create(self, area):
        """Test that name_normalized is automatically set when creating a sector"""
        sector = Sector.objects.create(
            area=area,
            name="Lidomorna",
            latitude=49.123456,
            longitude=16.654321,
        )
        assert sector.name_normalized == "lidomorna"
        assert sector.name == "Lidomorna"

    def test_sector_name_normalized_with_diacritics(self, area):
        """Test that name_normalized removes diacritics"""
        sector = Sector.objects.create(
            area=area,
            name="Vanousovy díry",
            latitude=49.123456,
            longitude=16.654321,
        )
        assert sector.name_normalized == "vanousovy diry"

    def test_sector_name_normalized_on_save(self, area):
        """Test that name_normalized is updated when name changes"""
        sector = Sector.objects.create(
            area=area,
            name="Lidomorna",
            latitude=49.123456,
            longitude=16.654321,
        )
        assert sector.name_normalized == "lidomorna"

        sector.name = "Stara rasovna"
        sector.save()
        assert sector.name_normalized == "stara rasovna"

    def test_sector_find_by_normalized_name(self, area):
        """Test finding sector by normalized name"""
        sector = Sector.objects.create(
            area=area,
            name="Lidomorna",
            latitude=49.123456,
            longitude=16.654321,
        )
        results = Sector.find_by_normalized_name("lidomorna")
        assert sector in results
        assert results.count() == 1

        # Case-insensitive
        results2 = Sector.find_by_normalized_name("LIDOMORNA")
        assert sector in results2

        # Diacritic-insensitive
        sector2 = Sector.objects.create(
            area=area,
            name="Vanousovy díry",
            latitude=49.123457,
            longitude=16.654322,
        )
        results3 = Sector.find_by_normalized_name("vanousovy diry")
        assert sector2 in results3


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

    def test_wall_name_normalized_on_create(self, sector):
        """Test that name_normalized is automatically set when creating a wall"""
        wall = Wall.objects.create(sector=sector, name="Vlevo")
        assert wall.name_normalized == "vlevo"
        assert wall.name == "Vlevo"

    def test_wall_name_normalized_with_diacritics(self, sector):
        """Test that name_normalized removes diacritics"""
        wall = Wall.objects.create(sector=sector, name="Vpravo")
        assert wall.name_normalized == "vpravo"

    def test_wall_name_normalized_on_save(self, sector):
        """Test that name_normalized is updated when name changes"""
        wall = Wall.objects.create(sector=sector, name="Vlevo")
        assert wall.name_normalized == "vlevo"

        wall.name = "Central"
        wall.save()
        assert wall.name_normalized == "central"

    def test_wall_find_by_normalized_name(self, sector):
        """Test finding wall by normalized name"""
        wall = Wall.objects.create(sector=sector, name="Vlevo")
        results = Wall.find_by_normalized_name("vlevo")
        assert wall in results
        assert results.count() == 1

        # Case-insensitive
        results2 = Wall.find_by_normalized_name("VLEVO")
        assert wall in results2

        # Diacritic-insensitive
        wall2 = Wall.objects.create(sector=sector, name="Vpravo")
        results3 = Wall.find_by_normalized_name("vpravo")
        assert wall2 in results3


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


@pytest.mark.django_db
class TestNameNormalization:
    """Test name normalization functionality across all models"""

    def test_name_normalized_empty_string(self, city):
        """Test that empty name results in empty name_normalized"""
        area = Area.objects.create(city=city, name="")
        assert area.name_normalized == ""

    def test_name_normalized_whitespace_handling(self, city):
        """Test that extra whitespace is normalized"""
        area = Area.objects.create(city=city, name="  Test  Area  ")
        assert area.name_normalized == "test area"

    def test_name_normalized_special_characters(self, city):
        """Test that special characters are handled correctly"""
        area = Area.objects.create(city=city, name="Test-Area_123")
        assert area.name_normalized == "test-area_123"

    def test_name_normalized_multiple_models_same_name(self, city, area, sector):
        """Test that different models can have the same normalized name"""
        city_obj = City.objects.create(name="Test")
        area_obj = Area.objects.create(city=city, name="Test")
        sector_obj = Sector.objects.create(
            area=area, name="Test", latitude=49.123456, longitude=16.654321
        )
        wall_obj = Wall.objects.create(sector=sector, name="Test")

        assert city_obj.name_normalized == "test"
        assert area_obj.name_normalized == "test"
        assert sector_obj.name_normalized == "test"
        assert wall_obj.name_normalized == "test"

    def test_name_normalized_czech_characters(self, city):
        """Test normalization of Czech characters"""
        test_cases = [
            ("Praha", "praha"),
            ("České Budějovice", "ceske budejovice"),
            ("Brno", "brno"),
            ("Dívčí válka", "divci valka"),
            ("Vlnová dálka", "vlnova dalka"),
            ("Palcošmé", "palcosme"),
            ("Barbařiny první krůčky", "barbariny prvni krucky"),
        ]

        for name, expected_normalized in test_cases:
            area = Area.objects.create(city=city, name=name)
            assert area.name_normalized == expected_normalized, f"Failed for: {name}"

    def test_name_normalized_update_preserves_other_fields(self, city):
        """Test that updating name doesn't affect other fields"""
        area = Area.objects.create(
            city=city, name="Original Name", description="Test description"
        )
        original_id = area.id
        original_description = area.description

        area.name = "New Name"
        area.save()

        area.refresh_from_db()
        assert area.id == original_id
        assert area.description == original_description
        assert area.name == "New Name"
        assert area.name_normalized == "new name"

    def test_find_by_normalized_name_no_results(self, city):
        """Test that find_by_normalized_name returns empty queryset when no matches"""
        Area.objects.create(city=city, name="Existing Area")
        results = Area.find_by_normalized_name("nonexistent")
        assert results.count() == 0

    def test_find_by_normalized_name_multiple_results(self, city):
        """Test that find_by_normalized_name can return multiple results"""
        area1 = Area.objects.create(city=city, name="Test Area")
        area2 = Area.objects.create(city=city, name="test area")  # Different case
        area3 = Area.objects.create(city=city, name="Test Area 2")  # Different name

        results = Area.find_by_normalized_name("test area")
        assert results.count() == 2
        assert area1 in results
        assert area2 in results
        assert area3 not in results
