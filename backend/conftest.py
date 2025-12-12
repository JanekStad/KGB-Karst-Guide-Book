"""
Root-level conftest.py for pytest.
This ensures shared fixtures are available to all tests regardless of where they're run from.
"""
import pytest

# Import shared fixtures - this makes them available globally
pytest_plugins = ["tests.shared_fixtures"]
