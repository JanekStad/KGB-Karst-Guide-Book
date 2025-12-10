import pytest
from comments.models import Comment


@pytest.mark.django_db
class TestComment:

    def test_comment_edited_flag_business_logic(self, user, boulder_problem):
        comment = Comment.objects.create(
            problem=boulder_problem, user=user, content="Original comment"
        )
        assert comment.edited is False

        # Simulate editing a comment
        comment.content = "Edited comment"
        comment.edited = True
        comment.save()
        assert comment.edited is True
