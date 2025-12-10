import pytest
from django.contrib.auth.models import User
from users.models import UserProfile


@pytest.mark.django_db
class TestUserProfile:

    def test_profile_auto_creation_signal(self, db):
        user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )
        # Verify the signal handler created the profile
        assert hasattr(user, "profile")
        assert isinstance(user.profile, UserProfile)
        assert UserProfile.objects.filter(user=user).exists()

    def test_profile_tick_count_property(self, user, boulder_problem):
        from lists.models import Tick
        from datetime import date

        assert user.profile.tick_count == 0

        Tick.objects.create(user=user, problem=boulder_problem, date=date.today())

        assert user.profile.tick_count == 1
