from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        'email',
        'first_name',
        'last_name',
        'is_premium',
        'premium_type',
        'is_onboarded',
        'total_workouts',
        'current_streak',
        'date_joined',
    )
    list_filter = (
        'is_premium',
        'premium_type',
        'is_onboarded',
        'is_staff',
        'is_active',
        'gender',
    )
    search_fields = ('email', 'first_name', 'last_name', 'username')
    ordering = ('-date_joined',)
    readonly_fields = (
        'id', 'date_joined', 'last_login',
        'created_at', 'updated_at',
        'total_workouts', 'total_distance', 'total_time',
        'current_streak', 'longest_streak',
        'max_runned_distance',
    )

    fieldsets = (
        ('Kimlik', {
            'fields': ('id', 'username', 'email', 'password',
                       'first_name', 'last_name', 'phone',
                       'profile_image', 'date_of_birth', 'gender',
                       'is_onboarded')
        }),
        ('Fiziksel', {'fields': ('weight', 'height')}),
        ('Koşu', {
            'fields': ('max_runned_distance', 'current_pace',
                       'preferred_running_days')
        }),
        ('İstatistik', {
            'fields': ('total_workouts', 'total_distance', 'total_time',
                       'current_streak', 'longest_streak')
        }),
        ('Premium', {
            'fields': ('is_premium', 'premium_type', 'premium_expires_at',
                       'total_tokens_used',
                       'reschedules_used_this_month', 'last_reschedule_reset')
        }),
        ('Bildirim', {
            'fields': ('push_token', 'timezone', 'preferred_reminder_time',
                       'notification_workout_reminder',
                       'notification_weekly_report',
                       'notification_achievements',
                       'notification_plan_updates')
        }),
        ('Tour', {
            'fields': ('tour_home', 'tour_calendar',
                       'tour_plans', 'tour_profile'),
            'classes': ('collapse',),
        }),
        ('Django Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser',
                       'groups', 'user_permissions',
                       'last_login', 'date_joined',
                       'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'password1', 'password2'),
        }),
    )
