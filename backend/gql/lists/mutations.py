"""GraphQL mutations for ticks"""

from ariadne import MutationType
from graphql import GraphQLError
from asgiref.sync import sync_to_async
from lists.models import Tick
from boulders.models import BoulderProblem
from django.core.exceptions import ValidationError

mutation = MutationType()


@mutation.field("createTick")
async def resolve_create_tick(_, info, input):
    """Create a new tick"""
    user = info.context.get("user")
    if not user:
        raise GraphQLError("Authentication required")

    def create_tick():
        # Check authentication inside sync context
        if not hasattr(user, 'is_authenticated') or not user.is_authenticated:
            raise GraphQLError("Authentication required")
        
        try:
            # Get problem
            problem = BoulderProblem.objects.get(id=input["problemId"])
            
            # Check if tick already exists (unique constraint)
            existing_tick = Tick.objects.filter(user=user, problem=problem).first()
            if existing_tick:
                raise GraphQLError("Tick already exists for this problem. Use updateTick instead.")

            # Create tick
            tick = Tick.objects.create(
                user=user,
                problem=problem,
                date=input["date"],
                notes=input.get("notes", ""),
                tick_grade=input.get("tickGrade") or None,
                suggested_grade=input.get("suggestedGrade") or None,
                rating=input.get("rating"),
            )
            # Eagerly load user and problem to avoid lazy-loading issues when GraphQL resolves fields
            tick = Tick.objects.select_related("user", "problem").get(id=tick.id)
            return tick
        except BoulderProblem.DoesNotExist:
            raise GraphQLError("Problem not found")
        except ValidationError as e:
            raise GraphQLError(f"Validation error: {str(e)}")

    return await sync_to_async(create_tick)()


@mutation.field("updateTick")
async def resolve_update_tick(_, info, id, input):
    """Update an existing tick"""
    user = info.context.get("user")
    if not user:
        raise GraphQLError("Authentication required")

    def update_tick():
        # Check authentication inside sync context
        if not hasattr(user, 'is_authenticated') or not user.is_authenticated:
            raise GraphQLError("Authentication required")
        
        try:
            # Use select_related to eagerly load user and problem to avoid lazy-loading issues
            tick = Tick.objects.select_related("user", "problem").get(id=id, user=user)
            
            # Update fields if provided
            if "date" in input:
                tick.date = input["date"]
            if "notes" in input:
                tick.notes = input["notes"]
            if "tickGrade" in input:
                tick.tick_grade = input["tickGrade"] or None
            if "suggestedGrade" in input:
                tick.suggested_grade = input["suggestedGrade"] or None
            if "rating" in input:
                tick.rating = input["rating"]
            
            tick.save()
            return tick
        except Tick.DoesNotExist:
            raise GraphQLError("Tick not found or you don't have permission to update it")
        except ValidationError as e:
            raise GraphQLError(f"Validation error: {str(e)}")

    return await sync_to_async(update_tick)()



@mutation.field("deleteTick")
async def resolve_delete_tick(_, info, id):
    """Delete a tick"""
    user = info.context.get("user")
    if not user:
        raise GraphQLError("Authentication required")

    def delete_tick():
        # Check authentication inside sync context
        if not hasattr(user, 'is_authenticated') or not user.is_authenticated:
            raise GraphQLError("Authentication required")
        
        try:
            tick = Tick.objects.get(id=id, user=user)
            tick.delete()
            return True
        except Tick.DoesNotExist:
            raise GraphQLError("Tick not found or you don't have permission to delete it")

    return await sync_to_async(delete_tick)()

