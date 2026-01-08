from ariadne_django.views import GraphQLAsyncView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from ariadne import graphql
from asgiref.sync import sync_to_async
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import Throttled
from backend.gql.dataloaders import get_dataloaders
from backend.gql.rate_limiting import check_graphql_rate_limit


@method_decorator(csrf_exempt, name="dispatch")
class TokenGraphQLView(GraphQLAsyncView):
    async def post(self, request, *args, **kwargs):
        # Authenticate user using DRF Token authentication
        auth = TokenAuthentication()
        try:
            user, token = await sync_to_async(auth.authenticate)(request)
            request.user = user
        except (TypeError, ValueError):
            request.user = None

        # Extract query string for rate limiting
        data = self.extract_data_from_request(request)
        query_string = data.get("query", "") if isinstance(data, dict) else ""

        # Check rate limit before processing
        try:
            await check_graphql_rate_limit(request, query_string)
        except Throttled as e:
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
        return JsonResponse(result, status=200 if success else 400)
