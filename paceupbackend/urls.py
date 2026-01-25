from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),

    # 1. Users & Auth (api/users/, api/token/)
    # include('apps.users.urls') dediğimizde o dosyadaki bütün yollar buraya eklenir.
    path('api/', include('apps.users.urls')),

    # 2. Programs & Workouts (api/programs/, api/workouts/)
    path('api/', include('apps.programs.urls')),

    # 3. Results (api/results/)
    path('api/', include('apps.activity.urls')),

    # 4. Gamification (api/achievements/)
    path('api/', include('apps.gamification.urls')),

    # 5. Notifications (api/notifications/)
    path('api/', include('apps.notifications.urls')),

    # 6. Analytics (api/stats/...)
    # Dikkat: Burada 'stats/' prefixini ana dosyada veriyoruz.
    # Böylece apps/analytics/urls.py içindeki 'summary/' -> 'api/stats/summary/' olur.
    path('api/stats/', include('apps.analytics.urls')),
]