import pytest
from datetime import date
from django.db import IntegrityError
from lists.models import Tick, UserList, ListEntry


@pytest.mark.django_db
class TestTick:

    def test_tick_unique_per_user_problem(self, user, boulder_problem):
        Tick.objects.create(user=user, problem=boulder_problem, date=date.today())

        # Should raise IntegrityError when trying to create duplicate tick
        with pytest.raises(IntegrityError):
            Tick.objects.create(user=user, problem=boulder_problem, date=date.today())

    def test_tick_str_includes_user_and_problem(self, user, boulder_problem):
        tick = Tick.objects.create(
            user=user, problem=boulder_problem, date=date.today()
        )
        expected = f"{user.username} ticked {boulder_problem} on {date.today()}"
        assert str(tick) == expected


@pytest.mark.django_db
class TestUserList:

    def test_user_list_str_includes_user(self, user):
        user_list = UserList.objects.create(
            user=user, name="My Projects", description="Problems I want to climb"
        )
        expected = f"{user.username}'s list: My Projects"
        assert str(user_list) == expected


@pytest.mark.django_db
class TestListEntry:

    def test_list_entry_unique_per_list_problem(self, user, boulder_problem):
        user_list = UserList.objects.create(user=user, name="My List")
        ListEntry.objects.create(user_list=user_list, problem=boulder_problem)

        # Should raise IntegrityError when trying to add duplicate problem
        with pytest.raises(IntegrityError):
            ListEntry.objects.create(user_list=user_list, problem=boulder_problem)

    def test_list_entry_str_includes_problem_and_list(self, user, boulder_problem):
        user_list = UserList.objects.create(user=user, name="My List")
        entry = ListEntry.objects.create(
            user_list=user_list, problem=boulder_problem, notes="Want to try this"
        )
        expected = f"{boulder_problem} in {user_list}"
        assert str(entry) == expected
