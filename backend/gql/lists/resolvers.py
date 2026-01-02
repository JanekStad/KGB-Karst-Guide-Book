from ariadne import ObjectType
from graphql import GraphQLError
from asgiref.sync import sync_to_async
from lists.models import Tick, UserList, ListEntry
from django.db.models import Count

tick = ObjectType("Tick")
user_list = ObjectType("UserList")
list_entry = ObjectType("ListEntry")


@tick.field("tickGrade")
def resolve_tick_grade(tick_obj, info):
    return tick_obj.tick_grade


@tick.field("suggestedGrade")
def resolve_suggested_grade(tick_obj, info):
    return tick_obj.suggested_grade


async def resolve_my_ticks(_, info):
    """Get current user's ticks"""
    user = info.context.get("user")
    if not user or not user.is_authenticated:
        raise GraphQLError("Authentication required")

    def get_ticks():
        return list(
            Tick.objects.filter(user=user)
            .select_related("user", "problem", "problem__area", "problem__area__city")
            .prefetch_related("problem__sector", "problem__wall")
            .order_by("-date", "-created_at")
        )

    return await sync_to_async(get_ticks)()


async def resolve_my_lists(_, info):
    """Get current user's lists"""
    user = info.context.get("user")
    if not user or not user.is_authenticated:
        raise GraphQLError("Authentication required")

    def get_lists():
        return list(
            UserList.objects.filter(user=user)
            .prefetch_related("listentry_set__problem")
            .annotate(problem_count_annotated=Count("listentry_set", distinct=True))
            .order_by("-created_at")
        )

    return await sync_to_async(get_lists)()


@user_list.field("problemCount")
def resolve_problem_count(list_obj, info):
    """Get problem count for a list"""
    if hasattr(list_obj, "problem_count_annotated"):
        return list_obj.problem_count_annotated
    return list_obj.listentry_set.count()


@user_list.field("problems")
def resolve_list_problems(list_obj, info):
    """Get problems in a list"""
    return list_obj.listentry_set.select_related("problem", "problem__area").all()


@user_list.field("isPublic")
def resolve_is_public(list_obj, info):
    """Resolve isPublic field"""
    return list_obj.is_public


@user_list.field("createdAt")
def resolve_created_at(list_obj, info):
    """Resolve createdAt field"""
    return list_obj.created_at


@user_list.field("updatedAt")
def resolve_updated_at(list_obj, info):
    """Resolve updatedAt field"""
    return list_obj.updated_at


@list_entry.field("addedAt")
def resolve_added_at(entry_obj, info):
    """Resolve addedAt field"""
    return entry_obj.added_at
