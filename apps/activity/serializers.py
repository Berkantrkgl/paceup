from rest_framework import serializers
from .models import WorkoutResult

class WorkoutResultSerializer(serializers.ModelSerializer):
    pace_display = serializers.ReadOnlyField()
    
    class Meta:
        model = WorkoutResult
        fields = '__all__'
        read_only_fields = ['user', 'actual_pace_seconds', 'calories_burned']