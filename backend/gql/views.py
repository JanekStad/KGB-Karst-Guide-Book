from ariadne_django.views import GraphQLAsyncView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from ariadne import graphql
from asgiref.sync import sync_to_async
from rest_framework.authentication import TokenAuthentication
from .dataloaders import get_dataloaders


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
        data = self.extract_data_from_request(request)
        success, result = await graphql(
            self.schema,
            data,
            **kwargs_graphql,
        )
        return JsonResponse(result, status=200 if success else 400)
