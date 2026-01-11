"""
Base Django settings shared across all environments.

This module contains all common settings that don't vary between environments.
Environment-specific overrides are in local.py, test.py, and prod.py.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Create logs directory if it doesn't exist
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)



ROOT_URLCONF = "karst_backend.urls"

WSGI_APPLICATION = "karst_backend.wsgi.application"

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "django_filters",
    "django_extensions",
    "ariadne_django",
    "boulders",
    "users",
    "comments",
    "lists",
    "gql",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "karst_backend.middleware.RequestContextMiddleware",  # Must be after AuthenticationMiddleware
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "karst_backend.middleware.RequestLoggingMiddleware",
    "karst_backend.middleware.UTF8CharsetMiddleware",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True

DEFAULT_CHARSET = "utf-8"

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 21,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # Rate limiting/throttling
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        # Default scopes for standard throttle classes (required)
        "anon": "100/hour",  # Default anonymous rate limit
        "user": "200/hour",  # Default authenticated user rate limit
        # Anonymous users - custom scopes
        "anon_burst": "100/hour",  # Burst requests for anonymous users
        "anon_sustained": "1000/day",  # Sustained requests for anonymous users
        # Authenticated users - custom scopes
        "user_burst": "200/hour",  # Burst requests for authenticated users
        "user_sustained": "5000/day",  # Sustained requests for authenticated users
        # Mutations (stricter limits)
        "mutations": "60/hour",  # Mutations for authenticated users
        "anon_mutations": "10/hour",  # Mutations for anonymous users (very strict)
        # GraphQL rate limits
        "graphql_query": "300/hour",  # GraphQL queries for authenticated users
        "graphql_mutation": "60/hour",  # GraphQL mutations for authenticated users
        "graphql_query_anon": "100/hour",  # GraphQL queries for anonymous users
        "graphql_mutation_anon": "10/hour",  # GraphQL mutations for anonymous users
    },
}

CORS_ALLOW_CREDENTIALS = True

# Logging Configuration
# Base logging configuration - can be overridden in environment-specific settings
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "()": "karst_backend.formatters.ContextualFormatter",
            "format": "{levelname:8} {asctime} [{request_id_short}] {name:25} - {message} | user={username} user_id={user_id} ip={ip_address}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "simple": {
            "()": "karst_backend.formatters.ContextualFormatter",
            "format": "{levelname:8} {asctime} [{request_id_short}] {message} | user={username} ip={ip_address}",
            "style": "{",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
        "json": {
            "()": "karst_backend.formatters.ContextualJSONFormatter",
        },
    },
    "filters": {
        "require_debug_false": {
            "()": "django.utils.log.RequireDebugFalse",
        },
        "require_debug_true": {
            "()": "django.utils.log.RequireDebugTrue",
        },
        "contextual": {
            "()": "karst_backend.formatters.ContextualFilter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
            "filters": ["require_debug_true", "contextual"],
        },
        "console_prod": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["require_debug_false", "contextual"],
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOGS_DIR / "django.log"),
            "maxBytes": 1024 * 1024 * 15,  # 15MB
            "backupCount": 10,
            "formatter": "verbose",
            "filters": ["contextual"],
        },
        "error_file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOGS_DIR / "errors.log"),
            "maxBytes": 1024 * 1024 * 15,  # 15MB
            "backupCount": 10,
            "formatter": "verbose",
            "level": "ERROR",
            "filters": ["contextual"],
        },
    },
    "root": {
        "handlers": ["console", "console_prod"],
        "level": "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["error_file", "console", "console_prod"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.db.backends": {
            "handlers": ["console", "console_prod"],
            "level": "WARNING",  # Set to DEBUG to log all SQL queries
            "propagate": False,
        },
        "django.db.backends.schema": {
            "handlers": ["console", "console_prod"],
            "level": "WARNING",  # Don't log schema operations
            "propagate": False,
        },
        "django.security": {
            "handlers": ["error_file", "console", "console_prod"],
            "level": "ERROR",
            "propagate": False,
        },
        "django.server": {
            "handlers": ["console", "console_prod"],
            "level": "WARNING",  # Only log warnings/errors - RequestLoggingMiddleware logs all requests with context
            "propagate": False,
        },
        # Application-specific loggers
        "karst_backend": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "gql": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "boulders": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "users": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "comments": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "lists": {
            "handlers": ["console", "console_prod", "file"],
            "level": "INFO",
            "propagate": False,
        },
    },
}
