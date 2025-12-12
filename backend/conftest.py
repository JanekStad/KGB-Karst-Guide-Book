"""
Root-level conftest.py for pytest.
This ensures shared fixtures are available to all tests regardless of where they're run from.
"""

import pytest

# Import shared fixtures - this makes them available globally
# tests.shared_fixtures contains auth-related fixtures (api_client, user, authenticated_client, etc.)
# Note: tests.conftest is automatically discovered by pytest since it's in a directory with tests,
# so we don't need to explicitly load it here via pytest_plugins
pytest_plugins = ["tests.shared_fixtures"]
