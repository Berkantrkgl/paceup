from rest_framework import serializers
from .models import User, Program, Workout, WorkoutResult, Achievement, Notification

# 1. USER SERIALIZER
# 1. USER SERIALIZER (Aynı)
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

# 2. WORKOUT RESULT SERIALIZER
class WorkoutResultSerializer(serializers.ModelSerializer):
    pace_display = serializers.ReadOnlyField()
    class Meta:
        model = WorkoutResult
        fields = '__all__'
        read_only_fields = ['user', 'actual_pace_seconds', 'calories_burned']

# 3. WORKOUT SERIALIZER
class WorkoutSerializer(serializers.ModelSerializer):
    result = WorkoutResultSerializer(read_only=True)
    pace_display = serializers.ReadOnlyField()
    program = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all())

    class Meta:
        model = Workout
        fields = [
            'id', 'program', 'title', 'workout_type', 
            'scheduled_date', 'day_of_week',
            'planned_distance', 'planned_duration', 
            'target_pace_seconds', 'pace_display', 
            'status', 'is_completed', 
            'result', 'created_at'
        ]

# 4. PROGRAM SERIALIZER (TEMİZLENDİ)
class ProgramSerializer(serializers.ModelSerializer):
    current_week_calculated = serializers.ReadOnlyField()
    progress_percent = serializers.ReadOnlyField()

    class Meta:
        model = Program
        fields = [
            'id', 'user', 'title', 'description', 'goal',
            'start_date', 'end_date', 'duration_weeks',
            'difficulty', 'workouts_per_week', 
            'total_workouts_count', 'completed_workouts_count',
            'status',
            'current_week_calculated', 
            'progress_percent',        
            # AI alanları kaldırıldı ❌
            'created_at'
        ]
        read_only_fields = ['user', 'completed_workouts_count', 'created_at']


# 5. ACHIEVEMENT SERIALIZER
class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'


# 6. NOTIFICATION SERIALIZER
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'