from ariadne import MutationType
from graphql import GraphQLError
from asgiref.sync import sync_to_async
from comments.models import Comment
from boulders.models import BoulderProblem

mutation = MutationType()


@mutation.field("createComment")
async def resolve_create_comment(_, info, input):
    """Create a new comment"""
    user = info.context.get("user")
    if not user:
        raise GraphQLError("Authentication required")

    def create_comment():
        # Check authentication inside sync context
        if not hasattr(user, "is_authenticated") or not user.is_authenticated:
            raise GraphQLError("Authentication required")

        try:
            # Get problem
            problem = BoulderProblem.objects.get(id=input["problemId"])

            # Validate content
            content = input.get("content", "").strip()
            if not content:
                raise GraphQLError("Comment content cannot be empty")

            # Create comment
            comment = Comment.objects.create(
                user=user,
                problem=problem,
                content=content,
            )
            return comment
        except BoulderProblem.DoesNotExist:
            raise GraphQLError("Problem not found")
        except Exception as e:
            raise GraphQLError(f"Error creating comment: {str(e)}")

    return await sync_to_async(create_comment)()
