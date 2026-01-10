"""
Local development settings.

This is the default environment for local development.
python-decouple reads from: 1) environment variables (highest priority), 2) .env.local, 3) .env
For Railway/deployment: Set environment variables directly (no .env file needed)
For local dev: Create .env.local file (or .env) in the backend/ directory

Note: python-decouple's config() automatically reads from environment variables first,
then looks for .env files. To use .env.local, we use RepositoryEnv.
"""

from pathlib import Path
from decouple import config, Csv, RepositoryEnv
import dj_database_url
import os
from .base import *  # noqa: F403, F401

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Try to load from .env.local first, then fallback to .env
# Environment variables always take precedence (Railway-compatible)
env_local_path = BASE_DIR / ".env.local"
env_path = BASE_DIR / ".env"

# Use .env.local if it exists, otherwise .env, otherwise just environment variables
# Environment variables always take precedence (Railway-compatible)
if env_local_path.exists():
    env_repo = RepositoryEnv(str(env_local_path))

    def _config(key, default=None, cast=None):
        # Environment variables take highest priority
        if key in os.environ:
            val = os.environ[key]
            if cast:
                return cast(val)
            return val
        # Fallback to .env.local file
        return env_repo(key, default=default, cast=cast)

elif env_path.exists():
    env_repo = RepositoryEnv(str(env_path))

    def _config(key, default=None, cast=None):
        if key in os.environ:
            val = os.environ[key]
            if cast:
                return cast(val)
            return val
        return env_repo(key, default=default, cast=cast)

else:
    # No .env file, use standard config (reads from environment variables only)
    _config = config

SECRET_KEY = _config(
    "SECRET_KEY",
    default="django-insecure-dev-key-change-in-production-do-not-use-in-prod",
)

DEBUG = _config("DEBUG", default=True, cast=bool)

ALLOWED_HOSTS = _config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=Csv(),
)

# Database: Use SQLite for local dev by default, but allow override via DATABASE_URL
# dj_database_url.config reads from environment variables first
database_url = _config("DATABASE_URL", default=None)
DATABASES = {
    "default": dj_database_url.config(
        default=database_url or f'sqlite:///{BASE_DIR / "db.sqlite3"}',
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# CORS: Allow local frontend ports
CORS_ALLOWED_ORIGINS = _config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://localhost:3000",
    cast=Csv(),
)

CSRF_TRUSTED_ORIGINS = _config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:5173,http://localhost:3000",
    cast=Csv(),
)  # noqa: F405
