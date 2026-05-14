from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UserViewSet, GoogleSignInView, AppleSignInView
from .webhooks import revenuecat_webhook

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    # Router URL'leri (api/users/...)
    path('', include(router.urls)),
    
    # JWT Auth URL'leri (api/token/...)
    # Kullanıcı yönetimi ile token yönetimi genelde yan yana durur
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Google Sign-In
    path('auth/google/', GoogleSignInView.as_view(), name='google_signin'),

    # Sign in with Apple
    path('auth/apple/', AppleSignInView.as_view(), name='apple_signin'),

    # RevenueCat webhook
    path('webhooks/revenuecat/', revenuecat_webhook, name='revenuecat_webhook'),
]