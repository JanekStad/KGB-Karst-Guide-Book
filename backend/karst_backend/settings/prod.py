"""
Production settings for deployed environments (Railway, etc.).

All sensitive values MUST come from environment variables.
Never use defaults for secrets in production.
In Railway, set environment variables in the platform UI - do NOT use .env files in production.
"""

from pathlib import Path
from decouple import config, Csv
import dj_database_url
from .base import *  # noqa: F403, F401

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# SECURITY: Secret key MUST be set via environment variable in production
SECRET_KEY = config("SECRET_KEY")  # No default - will raise error if not set

# SECURITY: DEBUG must be False in production
DEBUG = config("DEBUG", default=False, cast=bool)

if DEBUG:
    raise ValueError(
        "DEBUG must be False in production! Set DEBUG=False in your environment variables."
    )

# ALLOWED_HOSTS must be explicitly set in production
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    cast=Csv(),
)  # No default - will raise error if not set

# Database: Must use PostgreSQL in production via DATABASE_URL
DATABASES = {
    "default": dj_database_url.config(
        conn_max_age=600,
        conn_health_checks=True,
        ssl_require=True,  # Force SSL for production databases
    )
}

# If DATABASE_URL is not set, raise an error
if not DATABASES["default"]:
    raise ValueError("DATABASE_URL environment variable must be set in production!")

# CORS: Must explicitly set allowed origins in production
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    cast=Csv(),
)  # No default - must be set

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    cast=Csv(),
)  # Should match CORS_ALLOWED_ORIGINS

# Security settings for production
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = config(
    "SECURE_HSTS_SECONDS", default=31536000, cast=int
)  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# Static files: WhiteNoise handles this in production
# Ensure STATIC_ROOT is set (inherited from base.py)

# Email configuration (if needed)
EMAIL_BACKEND = config(
    "EMAIL_BACKEND",
    default="django.core.mail.backends.smtp.EmailBackend",
)
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="")

# Logging configuration for production
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": config("LOG_LEVEL", default="INFO"),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": config("DJANGO_LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
        "karst_backend": {
            "handlers": ["console"],
            "level": config("LOG_LEVEL", default="INFO"),
            "propagate": False,
        },
    },
}
