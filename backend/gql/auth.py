"""Authentication adapter for GraphQL using DRF Token authentication"""

from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class GraphQLTokenAuth:
    """Adapter to use DRF Token authentication with GraphQL"""

    def authenticate(self, request):
        """
        Authenticate request using DRF Token authentication.
        Returns user if authenticated, None otherwise.
        """
        auth = TokenAuthentication()
        try:
            user, token = auth.authenticate(request)
            return user
        except (TypeError, ValueError, AuthenticationFailed):
            return None
