from django.urls import path, include
from rest_framework.routers import DefaultRouter
from boulders.views import (
    CityViewSet,
    AreaViewSet,
    SectorViewSet,
    WallViewSet,
    BoulderProblemViewSet,
    BoulderImageViewSet,
)

router = DefaultRouter()
router.register(r"cities", CityViewSet, basename="city")
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"sectors", SectorViewSet, basename="sector")
router.register(r"walls", WallViewSet, basename="wall")
router.register(r"problems", BoulderProblemViewSet, basename="problem")
router.register(r"images", BoulderImageViewSet, basename="image")

# Backward compatibility: alias crags to areas
router.register(r"crags", AreaViewSet, basename="crag")

urlpatterns = [
    path("", include(router.urls)),
]
