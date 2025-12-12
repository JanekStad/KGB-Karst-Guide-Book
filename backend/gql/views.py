from ariadne_django.views import GraphQLAsyncView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from ariadne import graphql
from asgiref.sync import sync_to_async
from rest_framework.authentication import TokenAuthentication


@method_decorator(csrf_exempt, name="dispatch")
class TokenGraphQLView(GraphQLAsyncView):
    async def post(self, request, *args, **kwargs):
        auth = TokenAuthentication()
        try:
            user, token = await sync_to_async(auth.authenticate)(request)
            request.user = user
        except (TypeError, ValueError):
            request.user = None

        # Execute GraphQL query
        data = self.extract_data_from_request(request)
        success, result = await graphql(
            self.schema,
            data,
            context_value={"request": request, "user": request.user},
            **self.get_kwargs_graphql(request),
        )
        return JsonResponse(result, status=200 if success else 400)
