from django.urls import path, include
from rest_framework.routers import DefaultRouter
from backend.lists.views import TickViewSet, UserListViewSet, ListEntryViewSet

router = DefaultRouter()
router.register(r"ticks", TickViewSet, basename="tick")
router.register(r"lists", UserListViewSet, basename="list")
router.register(r"list-entries", ListEntryViewSet, basename="list-entry")

urlpatterns = [
    path("", include(router.urls)),
]
