from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from rest_framework.exceptions import Throttled
from asgiref.sync import sync_to_async


class GraphQLQueryThrottle(UserRateThrottle):
    """Rate limit for GraphQL queries (read operations)"""

    scope = "graphql_query"


class GraphQLMutationThrottle(UserRateThrottle):
    """Stricter rate limit for GraphQL mutations (write operations)"""

    scope = "graphql_mutation"


class GraphQLAnonQueryThrottle(AnonRateThrottle):
    """Rate limit for anonymous GraphQL queries"""

    scope = "graphql_query_anon"


class GraphQLAnonMutationThrottle(AnonRateThrottle):
    """Stricter rate limit for anonymous GraphQL mutations"""

    scope = "graphql_mutation_anon"


def is_mutation(query_string: str) -> bool:
    """Check if GraphQL query string contains a mutation"""
    if not query_string:
        return False
    # Simple check: if "mutation" keyword appears (case-insensitive)
    query_lower = query_string.lower().strip()
    return query_lower.startswith("mutation") or "mutation " in query_lower


async def check_graphql_rate_limit(request, query_string: str):
    """
    Check rate limit for GraphQL request.
    Returns None if allowed, raises Throttled exception if rate limited.
    """
    is_mut = is_mutation(query_string)
    user = request.user if hasattr(request, "user") else None
    is_authenticated = user and user.is_authenticated

    if is_mut:
        if is_authenticated:
            throttle = GraphQLMutationThrottle()
        else:
            throttle = GraphQLAnonMutationThrottle()
    else:
        if is_authenticated:
            throttle = GraphQLQueryThrottle()
        else:
            throttle = GraphQLAnonQueryThrottle()

    # Check rate limit
    def check_throttle():
        if not throttle.allow_request(request, None):
            wait = throttle.wait()
            raise Throttled(wait=wait)

    await sync_to_async(check_throttle)()
