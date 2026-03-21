import uuid
import requests as http_requests

from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from datetime import timedelta
from django.utils import timezone

from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from apps.users.models import User
from apps.users.serializers import UserSerializer, TOKEN_LIMIT_FREE

import os
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


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
    def activate_premium(self, request):
        """Demo: Gerçek ödeme entegrasyonu yapılana kadar direkt premium yap"""
        user = request.user
        premium_type = request.data.get("premium_type", "monthly")

        if premium_type not in ("monthly", "yearly"):
            return Response({"error": "premium_type 'monthly' veya 'yearly' olmalı."}, status=status.HTTP_400_BAD_REQUEST)

        duration = timedelta(days=30) if premium_type == "monthly" else timedelta(days=365)

        user.is_premium = True
        user.premium_type = premium_type
        user.premium_expires_at = timezone.now() + duration
        user.save(update_fields=["is_premium", "premium_type", "premium_expires_at"])

        serializer = self.get_serializer(user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def cancel_premium(self, request):
        """Demo: Premium üyeliği iptal et"""
        user = request.user
        user.is_premium = False
        user.premium_type = None
        user.premium_expires_at = None
        user.save(update_fields=["is_premium", "premium_type", "premium_expires_at"])

        serializer = self.get_serializer(user)
        return Response(serializer.data)


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