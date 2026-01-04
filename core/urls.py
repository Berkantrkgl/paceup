from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# ViewSet'ler ve APIView'ların hepsini import ediyoruz
from .views import (
    UserViewSet, ProgramViewSet, WorkoutViewSet, 
    WorkoutResultViewSet, AchievementViewSet, NotificationViewSet,
    StatsSummaryView, StatsChartsView, ActiveProgramStatsView
)

router = DefaultRouter()
# Standart CRUD Endpointleri
router.register(r'users', UserViewSet)
router.register(r'programs', ProgramViewSet, basename='program')
router.register(r'workouts', WorkoutViewSet, basename='workout')
router.register(r'results', WorkoutResultViewSet, basename='result')
router.register(r'achievements', AchievementViewSet, basename='achievement')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    # 1. JWT Authentication (Giriş & Token Yenileme)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # 2. Router URL'leri (users/, programs/ vb.)
    path('', include(router.urls)),
    
    # 3. Özel İstatistik Endpointleri (Dashboard Verileri)
    path('stats/summary/', StatsSummaryView.as_view(), name='stats-summary'),
    path('stats/charts/', StatsChartsView.as_view(), name='stats-charts'),
    path('stats/program/', ActiveProgramStatsView.as_view(), name='stats-program'),
]