# apps/notifications/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.gamification.models import Achievement
from .models import Notification
from .push import send_push_notification


@receiver(post_save, sender=Achievement)
def create_achievement_notification(sender, instance, created, **kwargs):
    if not created:
        return

    Notification.objects.create(
        user=instance.user,
        title="Tebrikler! Yeni Rozet",
        message=f"'{instance.title}' rozetini kazandın!",
        notification_type='achievement',
    )

    send_push_notification(
        user=instance.user,
        title="Yeni Rozet Kazandın! 🏆",
        body=f"'{instance.title}' rozetini kazandın, tebrikler!",
        data={
            "type": "achievement",
            "achievement_id": str(instance.id),
        },
        notification_type="achievement",
    )
