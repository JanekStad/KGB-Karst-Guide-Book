from ariadne import MutationType
from graphql import GraphQLError
from asgiref.sync import sync_to_async
from boulders.models import BoulderProblem
from django.core.exceptions import ValidationError

mutation = MutationType()


@mutation.field("updateProblemVideoLinks")
async def resolve_update_problem_video_links(_, info, id, input):
    """Update video links for a boulder problem"""
    user = info.context.get("user")
    if not user:
        raise GraphQLError("Authentication required")

    def update_video_links():
        # Check authentication inside sync context
        if not hasattr(user, "is_authenticated") or not user.is_authenticated:
            raise GraphQLError("Authentication required")

        try:
            # Get problem
            problem = BoulderProblem.objects.get(id=id)

            # Get videoLinks from input
            video_links = input.get("videoLinks", [])

            # Ensure video_links is a list (handle None case)
            if video_links is None:
                video_links = []

            # Validate videoLinks is a list
            if not isinstance(video_links, list):
                raise GraphQLError("videoLinks must be a list")

            # Validate each video link has required fields
            for video_link in video_links:
                if not isinstance(video_link, dict):
                    raise GraphQLError("Each video link must be an object")
                if "url" not in video_link:
                    raise GraphQLError("Each video link must have a 'url' field")
                if not video_link.get("url", "").strip():
                    raise GraphQLError("Video link URL cannot be empty")

            # Update video links
            problem.video_links = video_links
            problem.save()

            # Return updated problem
            return problem
        except BoulderProblem.DoesNotExist:
            raise GraphQLError("Problem not found")
        except ValidationError as e:
            raise GraphQLError(f"Validation error: {str(e)}")

    return await sync_to_async(update_video_links)()
