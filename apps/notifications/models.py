from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.db import models
import uuid

# Create your models here.
# 6. NOTIFICATION
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        REMINDER = 'reminder', _('Hatırlatıcı')     # "Bugün antrenmanın var!"
        ACHIEVEMENT = 'achievement', _('Tebrikler') # "Yeni rozet kazandın!"
        SYSTEM = 'system', _('Sistem/AI')           # "Programın güncellendi."
        INFO = 'info', _('Bilgi')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NotificationType.choices)

    is_read = models.BooleanField(default=False)
    
    # --- YÖNLENDİRME (DEEP LINKING MANTIĞI) ---
    # Bildirime tıklayınca kullanıcıyı ilgili antrenmana götürmek için:
    related_workout = models.ForeignKey('programs.Workout', on_delete=models.SET_NULL, null=True, blank=True)
    # Bildirime tıklayınca program detayına götürmek için:
    related_program = models.ForeignKey('programs.Program', on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.user.email})"