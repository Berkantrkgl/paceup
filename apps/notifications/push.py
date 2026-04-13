"""
Expo Push Notification utility.

send_push_notification(user, title, body, data, notification_type):
    - Kullanıcının push_token'ı yoksa atlar
    - İlgili notification_type toggle'ı kapalıysa atlar
    - Expo Push API'ye istek atar
    - DeviceNotRegistered hatasında token'ı temizler (stale token silme)
"""

import logging

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)
from requests.exceptions import ConnectionError, HTTPError

logger = logging.getLogger(__name__)


# notification_type → User model'indeki toggle alanı eşlemesi
NOTIFICATION_PREFERENCE_MAP = {
    "workout_reminder": "notification_workout_reminder",
    "weekly_report": "notification_weekly_report",
    "achievement": "notification_achievements",
    "plan_update": "notification_plan_updates",
}


def send_push_notification(user, title, body, data=None, notification_type=None):
    """
    Kullanıcıya Expo push notification gönderir.

    Args:
        user: User instance
        title: Bildirim başlığı
        body: Bildirim içeriği
        data: Dict, bildirime gömülecek extra veri (örn. {"workoutId": "..."})
        notification_type: "workout_reminder" | "achievement" | "weekly_report" | "plan_update"

    Returns:
        True: gönderildi
        False: atlandı veya hata
    """
    if not user.push_token:
        logger.info(f"[push] user={user.id} atlandı: push_token yok")
        return False

    if notification_type:
        pref_field = NOTIFICATION_PREFERENCE_MAP.get(notification_type)
        if pref_field and not getattr(user, pref_field, True):
            logger.info(
                f"[push] user={user.id} atlandı: {pref_field} kapalı"
            )
            return False

    message = PushMessage(
        to=user.push_token,
        title=title,
        body=body,
        data=data or {},
        sound="default",
        priority="high",
    )

    try:
        response = PushClient().publish(message)
        response.validate_response()
        logger.info(
            f"[push] user={user.id} gönderildi: title='{title}'"
        )
        return True

    except DeviceNotRegisteredError:
        # Token geçersiz (kullanıcı uygulamayı silmiş vb.) — temizle
        logger.warning(
            f"[push] user={user.id} stale token temizlendi"
        )
        user.push_token = None
        user.save(update_fields=["push_token"])
        return False

    except PushTicketError as exc:
        logger.error(
            f"[push] user={user.id} ticket hatası: {exc}"
        )
        return False

    except (PushServerError, ConnectionError, HTTPError) as exc:
        logger.error(
            f"[push] user={user.id} sunucu hatası: {exc}"
        )
        return False
