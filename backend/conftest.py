"""
Root-level conftest.py for pytest.
This ensures shared fixtures are available to all tests regardless of where they're run from.
"""

import pytest
from django.test import override_settings
from django.conf import settings

# Import shared fixtures - this makes them available globally
# tests.shared_fixtures contains auth-related fixtures (api_client, user, authenticated_client, etc.)
# Note: tests.conftest is automatically discovered by pytest since it's in a directory with tests,
# so we don't need to explicitly load it here via pytest_plugins
pytest_plugins = ["tests.shared_fixtures"]


@pytest.fixture(autouse=True)
def override_throttle_rates_for_rate_limiting_tests(request):
    """
    Override throttle rates for rate limiting tests only.
    test.py sets very high limits by default, so rate limiting tests need normal limits.
    This fixture runs automatically for all tests.
    """
    # Check if this is a rate limiting test
    is_rate_limiting_test = "test_rate_limiting" in request.node.nodeid

    if is_rate_limiting_test:
        # Set normal limits for rate limiting tests to actually test throttling
        normal_limit_rates = {
            "anon": "100/hour",
            "user": "200/hour",
            "anon_burst": "100/hour",
            "anon_sustained": "1000/day",
            "user_burst": "200/hour",
            "user_sustained": "5000/day",
            "mutations": "60/hour",
            "anon_mutations": "10/hour",
            "graphql_query": "300/hour",
            "graphql_mutation": "60/hour",
            "graphql_query_anon": "100/hour",
            "graphql_mutation_anon": "10/hour",
        }

        with override_settings(
            REST_FRAMEWORK={
                **settings.REST_FRAMEWORK,
                "DEFAULT_THROTTLE_RATES": normal_limit_rates,
            }
        ):
            yield
    else:
        # For non-rate-limiting tests, use the high limits from test.py (already set)
        yield
