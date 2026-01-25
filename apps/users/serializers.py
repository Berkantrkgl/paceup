from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    pace_display = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name', 'phone', 
            'profile_image', 'date_of_birth', 'gender', 'weight', 'height',
            'experience_level', 'preferred_distance', 'current_max_distance', 
            'current_pace', 'pace_display', 'weekly_goal',
            'total_workouts', 'total_distance', 'total_time', 'current_streak', 'longest_streak',
            'push_token', 'timezone', 'preferred_reminder_time',
            'notification_workout_reminder', 'notification_weekly_report', 
            'notification_achievements', 'notification_plan_updates'
        ]
        read_only_fields = ['username', 'total_workouts', 'total_distance', 'total_time', 'current_streak', 'longest_streak']