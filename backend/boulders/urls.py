from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CityViewSet,
    CragViewSet,
    WallViewSet,
    BoulderProblemViewSet,
    BoulderImageViewSet,
)

router = DefaultRouter()
router.register(r"cities", CityViewSet, basename="city")
router.register(r"crags", CragViewSet, basename="crag")
router.register(r"walls", WallViewSet, basename="wall")
router.register(r"problems", BoulderProblemViewSet, basename="problem")
router.register(r"images", BoulderImageViewSet, basename="image")

urlpatterns = [
    path("", include(router.urls)),
]
