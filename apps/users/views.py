from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken

from datetime import timedelta
from django.utils import timezone

from apps.users.models import User
from apps.users.serializers import UserSerializer, TOKEN_LIMIT_FREE


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