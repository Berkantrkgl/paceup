from django.contrib import admin

from .models import Achievement


@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'achievement_type',
                    'icon_name', 'earned_at')
    list_filter = ('achievement_type', 'earned_at')
    search_fields = ('title', 'description',
                     'user__email', 'user__first_name', 'user__last_name')
    date_hierarchy = 'earned_at'
    ordering = ('-earned_at',)
    readonly_fields = ('id', 'earned_at')
    autocomplete_fields = ('user',)
