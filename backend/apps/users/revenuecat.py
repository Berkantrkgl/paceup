"""RevenueCat REST API client + user sync helpers.

V2 API docs: https://www.revenuecat.com/docs/api-v2
"""
import logging
import requests
from django.conf import settings
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone


logger = logging.getLogger(__name__)

RC_BASE_URL = "https://api.revenuecat.com/v2"
RC_TIMEOUT = 10
PREMIUM_ENTITLEMENT_LOOKUP_KEY = "premium"


class RevenueCatError(Exception):
    pass


def _headers():
    if not settings.REVENUECAT_SECRET_KEY:
        raise RevenueCatError("REVENUECAT_SECRET_KEY ayarlanmamış")
    return {
        "Authorization": f"Bearer {settings.REVENUECAT_SECRET_KEY}",
        "Accept": "application/json",
    }


def _project_id():
    if not settings.REVENUECAT_PROJECT_ID:
        raise RevenueCatError("REVENUECAT_PROJECT_ID ayarlanmamış")
    return settings.REVENUECAT_PROJECT_ID


def _ms_to_datetime(ms):
    if ms is None:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=dt_timezone.utc)


def _get(path: str) -> dict:
    url = f"{RC_BASE_URL}{path}"
    resp = requests.get(url, headers=_headers(), timeout=RC_TIMEOUT)
    if resp.status_code == 404:
        return {}
    if not resp.ok:
        raise RevenueCatError(f"RevenueCat {resp.status_code}: {resp.text[:200]}")
    return resp.json()


def _delete(path: str) -> None:
    url = f"{RC_BASE_URL}{path}"
    resp = requests.delete(url, headers=_headers(), timeout=RC_TIMEOUT)
    # 404 = customer zaten yok, sorun değil
    if resp.status_code == 404:
        return
    if not resp.ok:
        raise RevenueCatError(f"RevenueCat DELETE {resp.status_code}: {resp.text[:200]}")


def delete_revenuecat_customer(app_user_id: str) -> None:
    """RC tarafındaki customer'ı ve tüm subscription/transaction history'sini siler.
    GDPR right-to-erasure için hesap silinirken çağrılır. Idempotent."""
    _delete(f"/projects/{_project_id()}/customers/{app_user_id}")


def get_active_entitlements(app_user_id: str) -> list:
    data = _get(f"/projects/{_project_id()}/customers/{app_user_id}/active_entitlements")
    return data.get("items") or []


def get_subscriptions(app_user_id: str) -> list:
    data = _get(f"/projects/{_project_id()}/customers/{app_user_id}/subscriptions")
    return data.get("items") or []


def sync_user_from_revenuecat(user, product_id_hint: str | None = None) -> bool:
    """RevenueCat'ten user'ın premium durumunu çekip DB'ye yansıtır.

    product_id_hint: Webhook'tan gelen Apple product ID (örn: com.example.app.premium.monthly).
    REST endpoint'ten product ID'ye erişemediğimiz için webhook bunu iletmeli. Yoksa premium_type güncellenmez.

    Returns True if user is premium after sync, False otherwise.
    """
    app_user_id = str(user.id)

    # Subscription'lardan premium entitlement kontrolü yapıyoruz çünkü
    # active_entitlements endpoint'i sadece entitlement_id döndürüyor, lookup_key yok.
    # Subscriptions endpoint'inde ise entitlements.items[].lookup_key mevcut.
    subscriptions = get_subscriptions(app_user_id)
    active_sub = _pick_active_subscription_with_premium(subscriptions)
    has_premium = active_sub is not None

    if has_premium:
        _apply_active_premium(user, active_sub, product_id_hint)
    else:
        _apply_no_premium(user)

    user.premium_last_verified_at = timezone.now()
    user.rc_app_user_id = app_user_id
    user.save(update_fields=[
        "is_premium", "premium_type", "premium_expires_at", "premium_started_at",
        "premium_will_renew", "store", "original_transaction_id",
        "premium_last_verified_at", "rc_app_user_id",
    ])
    return has_premium


def _subscription_has_premium(sub: dict) -> bool:
    items = (sub.get("entitlements") or {}).get("items") or []
    return any(e.get("lookup_key") == PREMIUM_ENTITLEMENT_LOOKUP_KEY for e in items)


def _pick_active_subscription_with_premium(subs: list) -> dict | None:
    if not subs:
        return None
    premium_subs = [s for s in subs if _subscription_has_premium(s)]
    if not premium_subs:
        return None
    preferred = [
        s for s in premium_subs
        if s.get("status") == "active" and s.get("gives_access")
    ]
    if preferred:
        return preferred[0]
    grace = [s for s in premium_subs if s.get("status") == "in_grace_period"]
    if grace:
        return grace[0]
    return premium_subs[0]


def _apply_active_premium(user, sub: dict | None, product_id_hint: str | None):
    user.is_premium = True

    if product_id_hint:
        user.premium_type = _product_id_to_type(product_id_hint)

    if not sub:
        return

    expires_ms = sub.get("current_period_ends_at") or sub.get("ends_at")
    if expires_ms:
        user.premium_expires_at = _ms_to_datetime(expires_ms)

    started_ms = sub.get("starts_at")
    if started_ms and not user.premium_started_at:
        user.premium_started_at = _ms_to_datetime(started_ms)

    store = sub.get("store")
    if store in ("app_store", "play_store"):
        user.store = store

    tx_id = sub.get("store_subscription_identifier")
    if tx_id:
        user.original_transaction_id = tx_id

    user.premium_will_renew = sub.get("auto_renewal_status") == "will_renew"


def _apply_no_premium(user):
    user.is_premium = False
    user.premium_will_renew = False
    user.premium_type = None
    user.premium_expires_at = None
    user.premium_started_at = None


def _product_id_to_type(product_id: str) -> str | None:
    p = (product_id or "").lower()
    if "yearly" in p or "annual" in p:
        return "yearly"
    if "monthly" in p:
        return "monthly"
    return None
