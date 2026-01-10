"""
Base Django settings shared across all environments.

This module contains all common settings that don't vary between environments.
Environment-specific overrides are in local.py, test.py, and prod.py.
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

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
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
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
