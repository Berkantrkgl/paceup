"""RevenueCat webhook handler.

RevenueCat docs: https://www.revenuecat.com/docs/integrations/webhooks

Her event'te bu endpoint çağrılır. İdempotent:
- RevenueCatWebhookEvent tablosuna event_id kaydedilir
- Aynı event tekrar gelirse sessizce 200 döner
"""
import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.users.models import RevenueCatWebhookEvent, User
from apps.users.revenuecat import sync_user_from_revenuecat


logger = logging.getLogger(__name__)


# Event tiplerinden hangilerinde user'ı resync'leyeceğiz
RESYNC_EVENTS = {
    "INITIAL_PURCHASE",
    "RENEWAL",
    "PRODUCT_CHANGE",
    "CANCELLATION",  # auto_renewal_status değişir, is_premium hala true kalır
    "UNCANCELLATION",
    "EXPIRATION",
    "BILLING_ISSUE",
    "SUBSCRIPTION_PAUSED",
    "SUBSCRIPTION_EXTENDED",
}


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def revenuecat_webhook(request):
    # 1. Auth
    expected = settings.REVENUECAT_WEBHOOK_AUTH
    if not expected:
        logger.error("REVENUECAT_WEBHOOK_AUTH ayarlanmamış")
        return Response({"error": "server misconfigured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    received = request.headers.get("Authorization", "")
    if received != expected:
        logger.warning("RevenueCat webhook auth başarısız")
        return Response({"error": "unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)

    # 2. Payload parse
    payload = request.data or {}
    event = payload.get("event") or {}
    event_id = event.get("id")
    event_type = event.get("type") or ""
    app_user_id = event.get("app_user_id") or event.get("original_app_user_id")

    if not event_id:
        logger.warning("RevenueCat webhook: event_id yok, yok sayılıyor")
        return Response({"ok": True, "skipped": "no_event_id"})

    # 3. İdempotency kaydı
    try:
        record = RevenueCatWebhookEvent.objects.create(
            event_id=event_id,
            event_type=event_type,
            app_user_id=app_user_id,
            raw_payload=payload,
        )
    except IntegrityError:
        logger.info("RevenueCat webhook duplicate: %s", event_id)
        return Response({"ok": True, "duplicate": True})

    # 4. User'ı sync'le — verify_purchase ile aynı user'a paralel gelebilir.
    # select_for_update ile satır kilitleyip sync'i atomic yapıyoruz; iki paralel
    # sync sırayla işlenir, lost-update olmaz.
    if event_type in RESYNC_EVENTS and app_user_id:
        try:
            with transaction.atomic():
                user = (
                    User.objects.select_for_update()
                    .filter(id=app_user_id)
                    .first()
                )
                if user:
                    product_id_hint = event.get("product_id")
                    sync_user_from_revenuecat(user, product_id_hint=product_id_hint)
                else:
                    logger.warning("RevenueCat webhook: user bulunamadı: %s", app_user_id)
        except Exception as e:
            logger.exception("RevenueCat webhook sync hatası: %s", e)
            # 200 dönüyoruz ki RevenueCat retry etmesin. Event DB'de kayıtlı, manuel replay edilebilir.

    record.processed_at = timezone.now()
    record.save(update_fields=["processed_at"])
    return Response({"ok": True})
