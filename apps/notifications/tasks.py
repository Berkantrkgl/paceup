"""
Scheduled task'lar — django-q2 ile her saat başı çalışır.

send_workout_reminders():
    Her kullanıcı için:
    - Kendi timezone'unda şu an saat, preferred_reminder_time'ın saatiyle eşleşiyor mu?
    - Eşleşiyorsa → ertesi gün için scheduled bir antrenmanı var mı?
    - Varsa → push gönder

Cron kaydı management command ile yapılır:
    python manage.py setup_periodic_tasks
"""

import logging
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.utils import timezone

from apps.programs.models import Workout
from apps.users.models import User

from .push import send_push_notification

logger = logging.getLogger(__name__)


def _user_local_now(user):
    """Kullanıcının kendi timezone'undaki şu anki datetime'ı döner."""
    tz_name = user.timezone or "UTC"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        logger.warning(
            f"[reminders] user={user.id} geçersiz timezone: {tz_name}, UTC kullanılıyor"
        )
        tz = ZoneInfo("UTC")
    return timezone.now().astimezone(tz)


def send_workout_reminders():
    """
    Her saat başı çalışır. Her kullanıcı için kendi TZ'inde
    preferred_reminder_time saati geldiyse ve ertesi gün
    antrenmanı varsa push gönderir.
    """
    eligible_users = User.objects.filter(
        notification_workout_reminder=True,
        push_token__isnull=False,
    ).exclude(push_token="")

    sent_count = 0
    checked_count = 0

    for user in eligible_users:
        checked_count += 1

        if not user.preferred_reminder_time:
            continue

        local_now = _user_local_now(user)

        # Saat başı task çalışır — kullanıcının tercih ettiği saat şu an mı?
        if local_now.hour != user.preferred_reminder_time.hour:
            continue

        tomorrow = (local_now + timedelta(days=1)).date()

        workout = (
            Workout.objects.filter(
                program__user=user,
                program__status="active",
                scheduled_date=tomorrow,
                status="scheduled",
            )
            .select_related("program")
            .first()
        )

        if not workout:
            continue

        distance_km = workout.planned_distance or 0
        duration_min = workout.planned_duration or 0

        body_parts = [workout.title]
        if distance_km:
            body_parts.append(f"{distance_km:g} km")
        if duration_min:
            body_parts.append(f"{duration_min} dk")

        body = " • ".join(body_parts)

        ok = send_push_notification(
            user=user,
            title="Yarın antrenmanın var! 🏃",
            body=body,
            data={
                "type": "workout_reminder",
                "workout_id": str(workout.id),
                "scheduled_date": workout.scheduled_date.isoformat(),
            },
            notification_type="workout_reminder",
        )

        if ok:
            sent_count += 1

    logger.info(
        f"[reminders] checked={checked_count} sent={sent_count}"
    )
    return {"checked": checked_count, "sent": sent_count}
