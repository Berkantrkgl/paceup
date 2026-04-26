from rest_framework import serializers
from .models import User

TOKEN_LIMIT_FREE = 50000


class UserSerializer(serializers.ModelSerializer):
    pace_display = serializers.ReadOnlyField()
    remaining_reschedules = serializers.SerializerMethodField()
    active_program_id = serializers.SerializerMethodField()
    remaining_tokens = serializers.SerializerMethodField()
    can_use_chat = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            # Identity
            'id', 'email', 'username', 'first_name', 'last_name', 'phone',
            'profile_image', 'date_of_birth', 'gender', 'is_onboarded',
            'tour_home', 'tour_calendar', 'tour_plans', 'tour_profile',
            # Physical
            'weight', 'height',
            # Running
            'max_runned_distance', 'current_pace', 'pace_display',
            'preferred_running_days',
            # Stats
            'total_workouts', 'total_distance', 'total_time',
            'current_streak', 'longest_streak',
            # Notifications
            'push_token', 'timezone', 'preferred_reminder_time',
            'notification_workout_reminder', 'notification_weekly_report',
            'notification_achievements', 'notification_plan_updates',
            # SaaS
            'is_premium', 'premium_type', 'premium_expires_at', 'premium_will_renew',
            'total_tokens_used',
            # Computed
            'remaining_reschedules',
            'active_program_id',
            'remaining_tokens',
            'can_use_chat',
        ]
        read_only_fields = [
            'username',
            'total_workouts', 'total_distance', 'total_time',
            'current_streak', 'longest_streak',
            'total_tokens_used',
            'remaining_reschedules', 'active_program_id',
            'remaining_tokens', 'can_use_chat',
            'is_premium', 'premium_type', 'premium_expires_at', 'premium_will_renew',
        ]

    def to_representation(self, instance):
        instance.check_premium_status()
        return super().to_representation(instance)

    def get_remaining_reschedules(self, obj):
        return obj.get_remaining_reschedules()

    def get_active_program_id(self, obj):
        active_program = obj.programs.filter(status='active').first()
        return str(active_program.id) if active_program else None

    def get_remaining_tokens(self, obj):
        if obj.is_premium:
            return None
        return max(0, TOKEN_LIMIT_FREE - (obj.total_tokens_used or 0))

    def get_can_use_chat(self, obj):
        if obj.is_premium:
            return True
        return (obj.total_tokens_used or 0) < TOKEN_LIMIT_FREE