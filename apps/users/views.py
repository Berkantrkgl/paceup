import uuid
import requests as http_requests

import jwt
from jwt import PyJWKClient

from django.db import transaction

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from apps.users.models import ChatSession, User
from apps.users.serializers import UserSerializer, TOKEN_LIMIT_FREE

import os
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

# Sign in with Apple — iOS bundle ID, identity_token'ın "aud" claim'i bununla eşleşmeli.
APPLE_CLIENT_ID = os.environ.get("APPLE_CLIENT_ID", "com.example.PaceUp")
APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"

# PyJWKClient Apple'ın public key'lerini kendi içinde cache'ler — modül yükünde
# bir kez kurulur, her istekte yeniden ağ çağrısı yapmaz.
_apple_jwk_client = PyJWKClient(APPLE_JWKS_URL)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)
        response_data = serializer.data
        response_data['refresh'] = str(refresh)
        response_data['access'] = str(refresh.access_token)

        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        user = request.user

        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)

        serializer = self.get_serializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_token_usage(self, request):
        tokens_used = request.data.get("tokens_used", 0)

        if not isinstance(tokens_used, int) or tokens_used <= 0:
            return Response(
                {"error": "Geçersiz token sayısı"},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user

        # Premium kullanıcılarda sayacı güncelleme
        if not user.is_premium:
            user.total_tokens_used = (user.total_tokens_used or 0) + tokens_used
            user.save(update_fields=["total_tokens_used"])

        remaining = None if user.is_premium else max(0, TOKEN_LIMIT_FREE - user.total_tokens_used)
        can_use = True if user.is_premium else user.total_tokens_used < TOKEN_LIMIT_FREE

        return Response({
            "total_tokens_used": user.total_tokens_used if not user.is_premium else None,
            "remaining_tokens": remaining,
            "can_use_chat": can_use,
        })
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def verify_purchase(self, request):
        """Frontend RevenueCat ile satın alma tamamladıktan sonra çağırır.

        RC webhook'u ile aynı anda gelebilir (race). select_for_update ile row lock
        alıyoruz; iki paralel sync birbirinin yazısını bozmaz, sırayla işlenir.
        """
        from apps.users.revenuecat import sync_user_from_revenuecat

        product_id = request.data.get("product_id") or None
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().get(pk=request.user.pk)
                sync_user_from_revenuecat(user, product_id_hint=product_id)
        except Exception as e:
            return Response(
                {"error": f"Satın alma doğrulanamadı: {str(e)}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def register_chat_session(self, request):
        """Frontend yeni bir AI chat thread'i başlatınca thread_id'yi user'a bağlar.

        Hesap silindiğinde bu thread_id'ler LangGraph saver tablolarından temizlenir
        (GDPR right-to-erasure). Admin'de kullanıcının sohbet sayısı görünür.

        Idempotent: aynı thread_id tekrar gönderilirse last_used_at güncellenir.
        """
        thread_id = request.data.get("thread_id")
        if not thread_id or not isinstance(thread_id, str):
            return Response(
                {"error": "thread_id zorunlu."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ChatSession.objects.update_or_create(
            thread_id=thread_id,
            defaults={"user": request.user},
        )
        return Response({"ok": True})

    @action(detail=False, methods=['delete'], permission_classes=[permissions.IsAuthenticated])
    def destroy_account(self, request):
        """Apple Guideline 5.1.1(v): kullanıcı hesabını uygulama içinden silebilmeli.

        Akış:
        1. Aktif premium varsa engelle (kullanıcı önce App Store'dan iptal etmeli)
        2. RC customer'ı sil (subscription history dahil)
        3. LangGraph checkpoint tablolarından thread'leri temizle
        4. Django user satırını sil — cascade ile programs/workouts/results/
           achievements/notifications/chat_sessions otomatik silinir
        """
        from apps.users.langgraph_cleanup import delete_threads
        from apps.users.revenuecat import delete_revenuecat_customer

        user = request.user
        user.check_premium_status()  # lazy refresh — webhook gecikmesi varsa RC'ye sor

        if user.is_premium:
            return Response(
                {
                    "error": "premium_active",
                    "message": (
                        "Aktif Premium aboneliğin var. Hesabını silmeden önce "
                        "App Store → Ayarlar → Apple ID → Abonelikler yolundan "
                        "PaceUp aboneliğini iptal etmen gerekiyor."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        app_user_id = str(user.id)
        thread_ids = list(user.chat_sessions.values_list("thread_id", flat=True))

        # 1. RC customer sil. Hata olursa log'la ama hesap silmeyi durdurma —
        #    kullanıcı zaten premium değil, RC tarafında orphan kalsa kullanıcıya
        #    zarar yok. Manual cleanup ile çözülür.
        try:
            delete_revenuecat_customer(app_user_id)
        except Exception:
            import logging
            logging.getLogger(__name__).exception(
                "RC customer delete failed for %s — proceeding with account deletion",
                app_user_id,
            )

        # 2. LangGraph thread cleanup (best-effort, kendi içinde hata yutar)
        delete_threads(thread_ids)

        # 3. Django user delete — cascade ile ilişkili her şey silinir
        user.delete()

        return Response({"ok": True}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def register_push_token(self, request):
        """Expo push token'ını kullanıcıya bağla (cihaz değişikliğinde günceller)."""
        push_token = request.data.get("push_token")

        if not push_token or not isinstance(push_token, str):
            return Response(
                {"error": "push_token gerekli."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not push_token.startswith("ExponentPushToken[") and not push_token.startswith("ExpoPushToken["):
            return Response(
                {"error": "Geçersiz Expo push token formatı."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        user.push_token = push_token
        user.save(update_fields=["push_token"])

        return Response({"success": True, "push_token": push_token})


class GoogleSignInView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")
        id_token_str = request.data.get("id_token")

        # Code flow: code + redirect_uri geldiyse token exchange yap
        if code:
            if not redirect_uri:
                return Response({"error": "redirect_uri gerekli."}, status=status.HTTP_400_BAD_REQUEST)

            token_response = http_requests.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )

            if token_response.status_code != 200:
                return Response(
                    {"error": "Google token exchange başarısız.", "details": token_response.json()},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            id_token_str = token_response.json().get("id_token")

        # id_token doğrulama (hem code flow hem eski flow için ortak)
        if not id_token_str:
            return Response({"error": "code veya id_token gerekli."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            idinfo = google_id_token.verify_oauth2_token(
                id_token_str, google_requests.Request(), GOOGLE_CLIENT_ID
            )
        except ValueError:
            return Response({"error": "Geçersiz Google token."}, status=status.HTTP_401_UNAUTHORIZED)

        email = idinfo.get("email")
        first_name = idinfo.get("given_name", "")
        last_name = idinfo.get("family_name", "")

        if not email:
            return Response({"error": "Google hesabında email bulunamadı."}, status=status.HTTP_400_BAD_REQUEST)

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "first_name": first_name,
                "last_name": last_name,
                "password": uuid.uuid4().hex,
            }
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "created": created,
        })


class AppleSignInView(APIView):
    """Sign in with Apple — App Store Guideline 4.8 gereği Google ile eşdeğer login.

    Frontend `expo-apple-authentication` ile native Apple Sign-In yapar ve
    `identity_token` (JWT) gönderir. Token Apple'ın public key'leriyle doğrulanır.

    Apple email/isim'i SADECE ilk girişte döner — sonraki girişlerde token'da
    email claim'i olur ama isim asla gelmez. O yüzden frontend ilk akıştan
    aldığı `full_name`'i body'de iletir; kullanıcı yoksa onu kaydederiz.
    Apple "Hide My Email" seçilirse email bir privaterelay.appleid.com adresi
    olur — bu tamamen geçerli, normal email gibi saklanır.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identity_token = request.data.get("identity_token")
        if not identity_token:
            return Response(
                {"error": "identity_token gerekli."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            signing_key = _apple_jwk_client.get_signing_key_from_jwt(identity_token)
            claims = jwt.decode(
                identity_token,
                signing_key.key,
                algorithms=["RS256"],
                audience=APPLE_CLIENT_ID,
                issuer=APPLE_ISSUER,
            )
        except jwt.PyJWTError:
            return Response(
                {"error": "Geçersiz Apple token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # "sub" = Apple'ın değişmez kullanıcı kimliği. Email her zaman token'da
        # bulunmaz; bulunmuyorsa sub bazlı bir placeholder email kullanırız.
        apple_sub = claims.get("sub")
        email = claims.get("email")

        if not apple_sub:
            return Response(
                {"error": "Apple token'ında kullanıcı kimliği bulunamadı."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not email:
            email = f"{apple_sub}@privaterelay.appleid.com"

        full_name = request.data.get("full_name") or {}
        first_name = (full_name.get("givenName") or "").strip()
        last_name = (full_name.get("familyName") or "").strip()

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email.split("@")[0],
                "first_name": first_name,
                "last_name": last_name,
                "password": uuid.uuid4().hex,
            },
        )

        if created:
            user.set_unusable_password()
            user.save(update_fields=["password"])

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "created": created,
        })