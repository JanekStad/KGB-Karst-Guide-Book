"""
URL configuration for karst_backend project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from graphql.views import TokenGraphQLView
from graphql.schema import schema

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("rest_framework.urls")),
    path("api/", include("boulders.urls")),
    path("api/", include("users.urls")),
    path("api/", include("comments.urls")),
    path("api/", include("lists.urls")),
    # GraphQL endpoint
    path(
        "graphql/",
        TokenGraphQLView.as_view(schema=schema, introspection=True),
        name="graphql",
    ),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)  # type: ignore[arg-type]
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)  # type: ignore[arg-type]
