from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    pace_display = serializers.ReadOnlyField()
    remaining_reschedules = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'phone', 
            'profile_image', 'date_of_birth', 'gender', 'weight', 'height',
            'max_runned_distance',
            'current_pace', 'pace_display',
            'total_workouts', 'total_distance', 'total_time', 'current_streak', 'longest_streak',
            'push_token', 'timezone', 'preferred_reminder_time',
            'notification_workout_reminder', 'notification_weekly_report', 
            'notification_achievements', 'notification_plan_updates',
            'is_premium', 'total_tokens_used', 'preferred_running_days',
            'remaining_reschedules'
        ]
        read_only_fields = ['username', 'total_workouts', 'total_distance', 'total_time', 'current_streak', 'longest_streak', 'remaining_reschedules', 'total_tokens_used']

    def get_remaining_reschedules(self, obj):
        return obj.get_remaining_reschedules()
    

    def get_active_program_id(self, obj):
        # User'ın aktif programını DB'ye kaydetmeden, anlık sorgulayıp dönüyoruz
        active_program = obj.programs.filter(status='active').first()
        return str(active_program.id) if active_program else None