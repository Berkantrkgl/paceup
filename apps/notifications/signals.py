# apps/notifications/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.gamification.models import Achievement
from .models import Notification

@receiver(post_save, sender=Achievement)
def create_achievement_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.user,
            title="Tebrikler! Yeni Rozet",
            message=f"'{instance.title}' rozetini kazandın!",
            notification_type='achievement', # Enum veya string
        )