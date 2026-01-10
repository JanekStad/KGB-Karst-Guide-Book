"""
Django settings module that dynamically loads environment-specific settings.

Environment detection priority:
1. DJANGO_SETTINGS_MODULE environment variable (if explicitly set to a specific module)
2. ENVIRONMENT environment variable (local, test, prod)
3. Defaults to 'local' for safety

For Railway/deployment, set: ENVIRONMENT=prod
For testing: ENVIRONMENT=test or use DJANGO_SETTINGS_MODULE=karst_backend.settings.test
For local dev: ENVIRONMENT=local (or leave unset, defaults to local)
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def get_environment() -> str:
    """Determine which environment settings to load."""
    # If DJANGO_SETTINGS_MODULE is explicitly set to a specific settings module,
    # extract environment from it (e.g., "karst_backend.settings.prod" -> "prod")
    django_settings_module = os.environ.get("DJANGO_SETTINGS_MODULE", "")
    if django_settings_module and "settings." in django_settings_module:
        # Extract environment from module path like "karst_backend.settings.prod"
        parts = django_settings_module.split(".")
        if len(parts) >= 3 and parts[-2] == "settings":
            return parts[-1]

    # Otherwise, check ENVIRONMENT variable or default to local
    return os.environ.get("ENVIRONMENT", "local")


ENVIRONMENT = get_environment()

if ENVIRONMENT == "test":
    from .test import *  # noqa: F403, F401
elif ENVIRONMENT == "prod":
    from .prod import *  # noqa: F403, F401
else:  # local or any other value defaults to local
    from .local import *  # noqa: F403, F401
