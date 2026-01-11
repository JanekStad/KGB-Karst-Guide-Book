import time
from ariadne_django.views import GraphQLAsyncView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from ariadne import graphql
from asgiref.sync import sync_to_async
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import Throttled, AuthenticationFailed
from gql.dataloaders import get_dataloaders
from gql.rate_limiting import check_graphql_rate_limit, is_mutation
from karst_backend.logging_utils import log_graphql_query, log_rate_limit_exceeded
from karst_backend.contextual_logger import RequestContext, get_logger

gql_logger = get_logger("gql")


@method_decorator(csrf_exempt, name="dispatch")
class TokenGraphQLView(GraphQLAsyncView):
    async def post(self, request, *args, **kwargs):
        # Authenticate user using DRF Token authentication
        auth = TokenAuthentication()
        try:
            user, token = await sync_to_async(auth.authenticate)(request)
            request.user = user
            # Update context with authenticated user (preserves existing request_id, ip_address from middleware)
            RequestContext.bind_user(user)
        except (TypeError, ValueError, AuthenticationFailed):
            request.user = None
            # No need to update context - RequestContextMiddleware already set user_id=None, username=None

        # Extract query string for rate limiting and logging
        data = self.extract_data_from_request(request)
        query_string = data.get("query", "") if isinstance(data, dict) else ""
        variables = data.get("variables", {}) if isinstance(data, dict) else {}
        operation_name = data.get("operationName") if isinstance(data, dict) else None

        # Check rate limit before processing
        try:
            await check_graphql_rate_limit(request, query_string)
        except Throttled as e:
            # Log rate limit exceeded
            log_rate_limit_exceeded(
                user=request.user,
                endpoint="/graphql/",
                throttle_scope=(
                    "graphql_mutation" if is_mutation(query_string) else "graphql_query"
                ),
            )
            # Return rate limit error in GraphQL format
            wait_time = getattr(e, "wait", None)
            return JsonResponse(
                {
                    "errors": [
                        {
                            "message": "Rate limit exceeded. Please try again later.",
                            "extensions": {
                                "code": "RATE_LIMIT_EXCEEDED",
                                "retryAfter": int(wait_time) if wait_time else None,
                            },
                        }
                    ]
                },
                status=429,
            )

        # Time the query execution
        start_time = time.time()

        # Get GraphQL kwargs (includes context_value)
        kwargs_graphql = self.get_kwargs_graphql(request)

        # Update context_value to include authenticated user
        if "context_value" in kwargs_graphql:
            context = kwargs_graphql["context_value"]
            if context is None:
                context = {}
            context["user"] = request.user
            context["request"] = request
            # Initialize DataLoaders for this request
            get_dataloaders(context)
            kwargs_graphql["context_value"] = context
        else:
            context = {"request": request, "user": request.user}
            # Initialize DataLoaders for this request
            get_dataloaders(context)
            kwargs_graphql["context_value"] = context

        # Execute GraphQL query
        success, result = await graphql(
            self.schema,
            data,
            **kwargs_graphql,
        )

        # Calculate execution time
        duration_ms = (time.time() - start_time) * 1000

        # Log the query
        errors = result.get("errors", []) if isinstance(result, dict) else []
        log_graphql_query(
            query_string=query_string,
            variables=variables,
            operation_name=operation_name,
            user=request.user,
            duration_ms=duration_ms,
            is_mutation=is_mutation(query_string),
            errors=errors if errors else None,
        )

        return JsonResponse(result, status=200 if success else 400)
