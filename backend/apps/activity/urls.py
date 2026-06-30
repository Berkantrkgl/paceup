from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WorkoutResultViewSet

router = DefaultRouter()
router.register(r'results', WorkoutResultViewSet, basename='result')

urlpatterns = [
    path('', include(router.urls)),
]