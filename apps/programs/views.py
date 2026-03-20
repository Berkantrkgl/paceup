import datetime
from datetime import timedelta
from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.programs.models import Program, Workout
from apps.programs.serializers import ProgramSerializer, WorkoutSerializer

class ProgramViewSet(viewsets.ModelViewSet):
    serializer_class = ProgramSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Program.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
        
    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        program_to_activate = self.get_object()
        user = request.user

        try:
            with transaction.atomic():
                Program.objects.filter(user=user, status='active').exclude(id=program_to_activate.id).update(status='inactive')
                program_to_activate.status = 'active'
                program_to_activate.save()

            return Response({"status": "success", "message": f"'{program_to_activate.title}' aktif edildi."}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='create_ai_plan')
    def create_ai_plan(self, request):
        data = request.data
        user = request.user
        
        try:
            with transaction.atomic():
                # Eskileri pasife çek
                Program.objects.filter(user=user, status='active').update(status='inactive')

                try:
                    start_date_obj = datetime.datetime.strptime(data['start_date'], "%Y-%m-%d").date()
                except ValueError:
                    return Response({"error": "Start date format error (YYYY-MM-DD)"}, status=400)

                end_date_obj = start_date_obj + timedelta(weeks=int(data['duration_weeks']))

                program = Program.objects.create(
                    user=user,
                    title=data['title'],
                    description=data.get('description', ''),
                    start_date=start_date_obj,
                    end_date=end_date_obj,
                    duration_weeks=int(data['duration_weeks']),
                    running_days=data.get('running_days', []), # YENİ EKLENDİ
                    status='active',
                    # workouts_per_week SİLİNDİ!
                    total_workouts_count=len(data['workouts'])
                )

                workout_objects = []
                for w_data in data['workouts']:
                    real_date = start_date_obj + timedelta(days=int(w_data['day_offset']))
                    
                    w = Workout(
                        program=program,
                        title=w_data['title'],
                        description=w_data.get('description', ''),
                        workout_type=w_data['workout_type'],
                        scheduled_date=real_date,
                        planned_distance=float(w_data['distance_km']),
                        planned_duration=int(w_data.get('duration_minutes', 0)),
                        target_pace_seconds=int(w_data.get('target_pace_seconds', 0))
                    )
                    workout_objects.append(w)
                
                for w in workout_objects:
                    w.save()

            return Response({
                "status": "success", 
                "program_id": str(program.id),
                "message": "Yeni plan aktif edildi."
            }, status=201)

        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=500)
        
    @action(detail=True, methods=['post'], url_path='reschedule')
    def reschedule(self, request, pk=None):
        program = self.get_object()
        user = request.user
        new_start_date_str = request.data.get('start_date')

        print(f"\n🚀 --- RESCHEDULE İŞLEMİ BAŞLADI ---")
        print(f"📌 Program: {program.title}")
        print(f"📌 İstenen Yeni Başlangıç: {new_start_date_str}")

        # 1. HAK KONTROLÜ
        if not user.use_reschedule():
            return Response({
                "error": "Bu ayki erteleme hakkınızı (2/2) doldurdunuz. Premium'a geçerek sınırsız erteleme yapabilirsiniz."
            }, status=403)

        if not new_start_date_str:
            return Response({"error": "start_date parametresi zorunludur."}, status=400)

        try:
            new_start_date = datetime.datetime.strptime(new_start_date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response({"error": "Tarih formatı YYYY-MM-DD olmalıdır."}, status=400)

        today = timezone.now().date()
        print(f"📌 Bugünün Tarihi: {today}")

        with transaction.atomic():
            # --- ADIM 1: TÜM LİSTEYİ ÇEK VE PYTHON'DA SIRALA ---
            all_workouts = list(program.workouts.all())
            # Sıralama: Önce planlanan tarih, sonra oluşturulma zamanı (UUID sıralaması yerine created_at daha güvenlidir ama modelde varsa)
            # Eğer created_at yoksa id'ye göre sıralayalım ki stabil olsun.
            all_workouts.sort(key=lambda w: (w.scheduled_date, w.created_at if w.created_at else w.id))

            print(f"🔍 Toplam Antrenman Sayısı: {len(all_workouts)}")
            print("📋 Mevcut Sıralama (İlk 10):")
            for i, w in enumerate(all_workouts[:10]):
                status_icon = "✅" if w.is_completed else "❌"
                print(f"   {i+1}. [{w.scheduled_date}] {w.title} ({w.workout_type}) - {status_icon}")

            # --- ADIM 2: AKTİF GÜNLERİ BELİRLE ---
            active_days = set()
            for w in all_workouts:
                active_days.add(w.scheduled_date.weekday())
            
            if not active_days:
                active_days = {1, 3, 5} 

            days_map = {0:"Pzt", 1:"Sal", 2:"Çar", 3:"Per", 4:"Cum", 5:"Cmt", 6:"Paz"}
            readable_days = [days_map[d] for d in sorted(list(active_days))]
            print(f"📅 Kullanıcının Aktif Günleri: {readable_days} (Kodları: {active_days})")

            # --- ADIM 3: ZİNCİRİ OLUŞTUR (Backtrack) ---
            past_and_today_candidates = []
            future_workouts = []

            for w in all_workouts:
                if w.scheduled_date <= today:
                    past_and_today_candidates.append(w)
                else:
                    future_workouts.append(w)
            
            print(f"🕰️  Geçmiş/Bugün Antrenman Sayısı: {len(past_and_today_candidates)}")
            print(f"🔮 Gelecek Antrenman Sayısı: {len(future_workouts)}")

            chain_to_move = []
            # Tersten tara
            print("🔙 Geriye Doğru Tarama Başlıyor...")
            for w in reversed(past_and_today_candidates):
                print(f"   -> Kontrol: {w.title} ({w.scheduled_date}) - Completed: {w.is_completed}")
                if w.is_completed:
                    print("   🛑 DUR! Tamamlanmış antrenman bulundu. Zincir koptu.")
                    break
                else:
                    print("   ➕ Zincire Eklendi.")
                    chain_to_move.append(w)
            
            chain_to_move.reverse() 
            workouts_to_shift = chain_to_move + future_workouts

            print(f"\n📦 TAŞINACAK PAKET (Sırası Bozulmamalı):")
            for i, w in enumerate(workouts_to_shift):
                print(f"   {i+1}. {w.title} ({w.workout_type}) [Eski Tarih: {w.scheduled_date}]")

            if not workouts_to_shift:
                print("⚠️ Kaydırılacak antrenman yok!")
                return Response({"message": "Kaydırılacak antrenman bulunamadı."}, status=200)

            # --- ADIM 4: YERLEŞTİRME ---
            print(f"\n🚀 YERLEŞTİRME BAŞLIYOR (Başlangıç: {new_start_date})")
            
            cursor_date = new_start_date
            
            for workout in workouts_to_shift:
                # Uygun gün bulma döngüsü
                loop_safety = 0
                original_cursor = cursor_date
                
                while cursor_date.weekday() not in active_days:
                    # Debug için gün atlamayı görelim
                    # print(f"   ... {cursor_date} ({days_map[cursor_date.weekday()]}) uygun değil, atlanıyor.")
                    cursor_date += datetime.timedelta(days=1)
                    loop_safety += 1
                    if loop_safety > 30: # Sonsuz döngü koruması
                        break
                
                print(f"   ✅ Atandı: {workout.title} -> {cursor_date} ({days_map[cursor_date.weekday()]})")
                
                # DB İşlemi
                workout.scheduled_date = cursor_date
                if workout.status == 'missed':
                    workout.status = 'scheduled'
                workout.save()
                
                # Bir sonraki gün
                cursor_date += datetime.timedelta(days=1)

            # --- ADIM 5: Bitiş ---
            # DB'den taze veri çekip sonuncuyu bul
            all_workouts_refresh = list(Program.objects.get(id=program.id).workouts.all())
            all_workouts_refresh.sort(key=lambda w: w.scheduled_date)
            last_workout = all_workouts_refresh[-1]
            
            if last_workout:
                program.end_date = last_workout.scheduled_date
                program.save()
                print(f"🏁 Program Bitiş Tarihi Güncellendi: {program.end_date}")

        print("--- İŞLEM TAMAMLANDI ---\n")
        return Response({
            "status": "success",
            "message": f"Debug işlemi tamamlandı. Konsolu kontrol et.",
            "moved_count": len(workouts_to_shift)
        })


class WorkoutViewSet(viewsets.ModelViewSet):
    serializer_class = WorkoutSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.now().date()

        # Otomatik Missed Güncellemesi
        Workout.objects.filter(
            program__user=user,
            scheduled_date__lt=today,
            is_completed=False
        ).exclude(
            status='missed' # Enum kullanıyorsan Workout.Status.MISSED
        ).update(status='missed')

        queryset = Workout.objects.filter(program__user=user)

        if self.request.query_params.get('only_active') == 'true':
            queryset = queryset.filter(program__status='active')

        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(scheduled_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(scheduled_date__lte=end_date)

        return queryset.order_by('scheduled_date')