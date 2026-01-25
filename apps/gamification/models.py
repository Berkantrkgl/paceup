from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.db import models
import uuid

# Create your models here.
# 5. ACHIEVEMENT
class Achievement(models.Model):
    class AchievementType(models.TextChoices):
        DISTANCE = 'distance', _('Mesafe Rozeti')
        WORKOUT_COUNT = 'workout_count', _('Antrenman Sayısı') # <--- BU EKLENDİ
        STREAK = 'streak', _('Seri Rozeti')
        PACE = 'pace', _('Hız Rozeti')
        COMPLETION = 'completion', _('Tamamlama Rozeti')
        SPECIAL = 'special', _('Özel Rozet')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievements')
    
    title = models.CharField(max_length=255)       # "Maratoncu Ruhu"
    description = models.TextField()               # "Toplamda 42km koşuyu tamamladın."
    achievement_type = models.CharField(max_length=50, choices=AchievementType.choices)

    # --- UI İÇİN GÖRSEL VERİ ---
    # React Native'deki Ionicon ismi (Örn: 'trophy', 'flame', 'medal')
    icon_name = models.CharField(max_length=50, default='trophy')
    # Hex kodu (Örn: '#FFD700')
    icon_color = models.CharField(max_length=20, default='#FFD700')

    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-earned_at'] # En son kazanılan en üstte

    def __str__(self):
        return f"{self.user.email} - {self.title}"