from rest_framework import viewsets, permissions
from apps.activity.models import WorkoutResult
from apps.activity.serializers import WorkoutResultSerializer

class WorkoutResultViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WorkoutResult.objects.filter(user=self.request.user).order_by('-completed_at')
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)