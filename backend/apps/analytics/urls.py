from django.urls import path
from .views import StatsSummaryView, StatsChartsView, ActiveProgramStatsView

urlpatterns = [
    # URL yapısı: /api/stats/summary/ olacak (Main url'de prefix vereceğiz)
    path('summary/', StatsSummaryView.as_view(), name='stats-summary'),
    path('charts/', StatsChartsView.as_view(), name='stats-charts'),
    path('program/', ActiveProgramStatsView.as_view(), name='stats-program'),
]