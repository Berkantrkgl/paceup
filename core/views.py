from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework_simplejwt.tokens import RefreshToken

from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta

from .models import User, Program, Workout, WorkoutResult, Achievement, Notification
from .serializers import (
    UserSerializer, ProgramSerializer, WorkoutSerializer, 
    WorkoutResultSerializer, AchievementSerializer, NotificationSerializer
)

# -------------------------------------------------------------------------
# 1. VIEWSETS (CRUD İŞLEMLERİ)
# -------------------------------------------------------------------------

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        # Kayıt olma (Create) herkese açık olmalı
        if self.action == 'create':
            return [permissions.AllowAny()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        """
        Kayıt olma işlemi: User oluştur + JWT Token üret ve dön.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Token üret
        refresh = RefreshToken.for_user(user)

        response_data = serializer.data
        response_data['refresh'] = str(refresh)
        response_data['access'] = str(refresh.access_token)

        headers = self.get_success_headers(serializer.data)
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=['get', 'put', 'patch'], permission_classes=[permissions.IsAuthenticated])
    def me(self, request):
        """
        /users/me/ endpoint'i.
        PUT veya PATCH ile profil güncellemeye izin verir.
        """
        user = request.user
        
        if request.method == 'GET':
            serializer = self.get_serializer(user)
            return Response(serializer.data)
        
        # Hem PUT hem PATCH geldiğinde güncelleme yap
        elif request.method in ['PUT', 'PATCH']:
            # partial=True diyerek her iki metodda da "Kısmi Güncelleme"ye izin veriyoruz.
            # Böylece kullanıcı sadece "weight" gönderse bile kabul ederiz.
            serializer = self.get_serializer(user, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)

class ProgramViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Program.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class WorkoutViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Workout.objects.filter(program__user=self.request.user)

class WorkoutResultViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # GÜNCELLEME: Artık direkt user üzerinden sorguluyoruz.
        # Böylece 'Plansız/Serbest Koşular' da listeye dahil oluyor.
        return WorkoutResult.objects.filter(user=self.request.user).order_by('-completed_at')
    
    def perform_create(self, serializer):
        # Kaydederken user'ı request'ten alıp atıyoruz
        serializer.save(user=self.request.user)

class AchievementViewSet(viewsets.ModelViewSet):
    serializer_class = AchievementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Achievement.objects.filter(user=self.request.user)

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')


# -------------------------------------------------------------------------
# 2. İSTATİSTİK VIEWS (CUSTOM ENDPOINTS)
# -------------------------------------------------------------------------

from rest_framework.views import APIView

# core/views.py

class StatsSummaryView(APIView):
    """
    Hero kartları ve Haftalık Hedef durumu.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        
        # 1. ÖMÜR BOYU İSTATİSTİKLER
        stats = WorkoutResult.objects.filter(user=user).aggregate(
            total_dist=Sum('actual_distance'),
            total_dur=Sum('actual_duration'),
            total_count=Count('id'),
            total_cal=Sum('calories_burned')
        )

        # 2. HAFTALIK DURUM
        start_of_week = today - timedelta(days=today.weekday())
        this_week_count = WorkoutResult.objects.filter(
            user=user,
            completed_at__date__gte=start_of_week
        ).count()

        # --- 3. DÜZELTİLEN KISIM: GERÇEK AKTİF GÜN SAYISI ---
        # Kullanıcının antrenman yaptığı benzersiz gün sayısı (count distinct dates)
        # values('completed_at__date') ile tarihleri gruplarız, sonra count alırız.
        active_days_count = WorkoutResult.objects.filter(user=user)\
            .values('completed_at__date')\
            .distinct()\
            .count()

        # Eğer hiç yoksa 0 döner, görsel açıdan en az 1 görünsün istersen logic ekleyebilirsin
        # ama doğrusu 0 veya gerçek sayıdır.

        return Response({
            # Hero Kartları
            "total_distance": round(stats.get('total_dist') or 0.0, 1),
            "total_duration_mins": stats.get('total_dur') or 0,
            "total_workouts": stats.get('total_count') or 0,
            "calories_burned": stats.get('total_cal') or 0,
            
            # Streak & Aktivite
            "current_streak": user.current_streak, 
            "days_active": active_days_count, # <-- ARTIK GERÇEK SAYI

            # Haftalık Hedef
            "weekly_goal": user.weekly_goal,
            "weekly_progress": this_week_count,
        })


class StatsChartsView(APIView):
    """
    Çizgi grafikleri için veriyi hazırlar.
    Completed_at (datetime) alanını date'e çevirip gruplar.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        period = request.query_params.get('period', 'week')
        
        today = timezone.now().date()
        
        if period == 'week':
            start_date = today - timedelta(days=6)
        else:
            start_date = today - timedelta(days=29)

        # 1. Veriyi çek (GÜNCELLEME: completed_at ve user filtresi)
        # completed_at__date__gte Django'nun datetime -> date dönüşümünü kullanır
        results = WorkoutResult.objects.filter(
            user=user, 
            completed_at__date__gte=start_date
        ).values('completed_at', 'actual_distance', 'actual_duration')

        # 2. Python tarafında gruplama (DB bağımsız çözüm)
        data_map = {}
        
        for res in results:
            # completed_at bir datetime objesidir, .date() ile günü alalım
            date_key = str(res['completed_at'].date())
            
            if date_key not in data_map:
                data_map[date_key] = {'dist': 0.0, 'dur': 0}
            
            data_map[date_key]['dist'] += res['actual_distance']
            data_map[date_key]['dur'] += res['actual_duration']

        # 3. Grafiğin boş günlerini 0 ile doldur
        labels = []
        distances = []
        paces = [] # Pace grafiği için (dk/km cinsinden float)

        current = start_date
        while current <= today:
            d_str = str(current)
            labels.append(current.strftime("%d/%m")) # Label: 13/05
            
            if d_str in data_map:
                val = data_map[d_str]
                dist = val['dist']
                dur = val['dur']
                
                distances.append(round(dist, 1))
                
                # Pace hesabı (dk/km) -> Grafikte float göstermek için
                if dist > 0:
                    pace_val = round(dur / dist, 2) # Örn: 5.5 (5:30 demek)
                    paces.append(pace_val)
                else:
                    paces.append(0.0)
            else:
                distances.append(0.0)
                paces.append(0.0)
            
            current += timedelta(days=1)

        return Response({
            "labels": labels,
            "datasets": [
                {"data": distances} # Mesafe Dataseti
            ],
            "pace_data": paces # Hız Dataseti
        })

class ActiveProgramStatsView(APIView):
    """
    Aktif program detayı + SIRADAKİ ANTRENMAN
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        
        active_prog = Program.objects.filter(user=user, status='active').first()
        
        if not active_prog:
            return Response({"has_active_program": False})

        # SIRADAKİ ANTRENMANI BUL (Bugün veya gelecekteki ilk antrenman)
        # is_completed=False VE tarihi >= bugün
        next_workout = Workout.objects.filter(
            program=active_prog,
            is_completed=False,
            scheduled_date__gte=today
        ).order_by('scheduled_date').first()

        next_workout_data = None
        if next_workout:
            # Serializer kullanmadan basit obje dönelim (Hız için)
            next_workout_data = {
                "id": str(next_workout.id),
                "title": next_workout.title,
                "date": next_workout.scheduled_date,
                "type": next_workout.workout_type,
                "day_name": next_workout.scheduled_date.strftime("%A") # "Monday"
            }

        return Response({
            "has_active_program": True,
            "title": active_prog.title,
            
            # İstatistikler
            "current_week": active_prog.current_week_calculated,
            "total_weeks": active_prog.duration_weeks,
            "total_workouts": active_prog.total_workouts_count,
            "completed_workouts": active_prog.completed_workouts_count,
            "progress_percent": active_prog.progress_percent,
            
            # UI İçin Ekstra
            "next_workout": next_workout_data # <--- YENİ EKLENDİ
        })