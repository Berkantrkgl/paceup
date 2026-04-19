from django.contrib import admin

from .models import Program, Workout


class WorkoutInline(admin.TabularInline):
    model = Workout
    extra = 0
    fields = ('scheduled_date', 'title', 'workout_type', 'status',
              'planned_distance', 'planned_duration')
    readonly_fields = fields
    can_delete = False
    show_change_link = True


@admin.register(Program)
class ProgramAdmin(admin.ModelAdmin):
    list_display = ('title', 'user', 'status', 'goal',
                    'start_date', 'end_date', 'duration_weeks',
                    'completed_workouts_count', 'total_workouts_count')
    list_filter = ('status', 'goal', 'start_date')
    search_fields = ('title', 'user__email', 'user__first_name',
                     'user__last_name')
    date_hierarchy = 'start_date'
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at',
                       'completed_workouts_count', 'total_workouts_count')
    autocomplete_fields = ('user',)
    inlines = [WorkoutInline]


@admin.register(Workout)
class WorkoutAdmin(admin.ModelAdmin):
    list_display = ('scheduled_date', 'title', 'workout_type', 'status',
                    'program', 'planned_distance', 'planned_duration')
    list_filter = ('status', 'workout_type', 'scheduled_date',
                   'is_completed')
    search_fields = ('title', 'program__title',
                     'program__user__email')
    date_hierarchy = 'scheduled_date'
    ordering = ('-scheduled_date',)
    readonly_fields = ('id', 'created_at', 'updated_at')
    autocomplete_fields = ('program',)
