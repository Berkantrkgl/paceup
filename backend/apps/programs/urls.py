from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProgramViewSet, WorkoutViewSet

router = DefaultRouter()
router.register(r'programs', ProgramViewSet, basename='program')
router.register(r'workouts', WorkoutViewSet, basename='workout')

urlpatterns = [
    path('', include(router.urls)),
]