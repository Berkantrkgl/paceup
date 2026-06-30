from django.contrib import admin

from .models import WorkoutResult


@admin.register(WorkoutResult)
class WorkoutResultAdmin(admin.ModelAdmin):
    list_display = ('user', 'workout', 'actual_distance',
                    'actual_duration', 'feeling', 'completed_at')
    list_filter = ('feeling', 'completed_at')
    search_fields = ('user__email', 'user__first_name',
                     'user__last_name', 'workout__title')
    date_hierarchy = 'completed_at'
    ordering = ('-completed_at',)
    readonly_fields = ('id',)
    autocomplete_fields = ('user', 'workout')
