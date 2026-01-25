from rest_framework import serializers
from .models import Program, Workout

# Cross-App Import: Result verisini Workout içinde göstermek için
from apps.activity.serializers import WorkoutResultSerializer

class WorkoutSerializer(serializers.ModelSerializer):
    # Nested Serializer kullanımı
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
            'created_at'
        ]
        read_only_fields = ['user', 'completed_workouts_count', 'created_at']