"""
Test settings for running pytest and other tests.

Optimized for speed and isolated test runs.
Environment variables take precedence, then .env.test file (if exists).
Most settings have safe defaults for testing.
"""
from pathlib import Path
from decouple import config, Csv, RepositoryEnv
import os
from .base import *  # noqa: F403, F401

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Test-specific secret key (not used in production)
SECRET_KEY = config(
    "SECRET_KEY",
    default="test-secret-key-for-pytest-only-not-for-production",
)

DEBUG = False  # Tests should run with DEBUG=False to catch production issues

ALLOWED_HOSTS = ["testserver", "localhost", "127.0.0.1"]

# Use in-memory SQLite for fastest test execution
# Can be overridden via DATABASE_URL env var if needed for integration tests
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Disable migrations for faster tests (can be enabled per-test if needed)
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None


# Uncomment the following to skip migrations in tests (faster but less realistic):
# MIGRATION_MODULES = DisableMigrations()

# Password validation - can be relaxed for tests if needed
# AUTH_PASSWORD_VALIDATORS = []

# CORS: Minimal for tests
CORS_ALLOWED_ORIGINS = []
CSRF_TRUSTED_ORIGINS = []

# Disable WhiteNoise for tests (not needed)
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"

# Email backend - use console for tests
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Cache backend - use dummy cache for tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}

# Reduce logging verbosity during tests
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "WARNING",
    },
}
