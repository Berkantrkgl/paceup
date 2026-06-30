from rest_framework import viewsets, permissions
from apps.gamification.models import Achievement
from apps.gamification.serializers import AchievementSerializer

class AchievementViewSet(viewsets.ModelViewSet):
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Achievement.objects.filter(user=self.request.user)