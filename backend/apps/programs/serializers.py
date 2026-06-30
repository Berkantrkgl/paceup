from rest_framework import serializers
from .models import Program, Workout
from apps.activity.serializers import WorkoutResultSerializer

class WorkoutSerializer(serializers.ModelSerializer):
    result = WorkoutResultSerializer(read_only=True)
    pace_display = serializers.ReadOnlyField()
    program = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all())

    class Meta:
        model = Workout
        fields = [
            'id', 'program', 'title', 'description', 'workout_type',
            'scheduled_date', 'day_of_week',
            'planned_distance', 'planned_duration', 
            'target_pace_seconds', 'pace_display', 
            'status', 'is_completed', 
            'result', 'created_at'
        ]

class ProgramSerializer(serializers.ModelSerializer):
    current_week_calculated = serializers.ReadOnlyField()
    progress_percent = serializers.ReadOnlyField()
    workouts = WorkoutSerializer(many=True, read_only=True)

    class Meta:
        model = Program
        fields = [
            'id', 'user', 'title', 'description', 'goal',
            'start_date', 'end_date', 'duration_weeks',
            'running_days', # workouts_per_week SİLİNDİ, running_days EKLENDİ
            'total_workouts_count', 'completed_workouts_count',
            'status',
            'current_week_calculated', 
            'progress_percent',
            'workouts', 
            'created_at'
        ]
        read_only_fields = ['user', 'completed_workouts_count', 'created_at']