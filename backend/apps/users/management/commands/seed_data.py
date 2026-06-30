import random
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone

# --- GÜNCELLENEN IMPORTLAR ---
from apps.users.models import User
from apps.programs.models import Program, Workout
from apps.activity.models import WorkoutResult

class Command(BaseCommand):
    help = 'Yeni Model yapısına uygun, temizlenmiş dummy veriler basar.'

    def handle(self, *args, **kwargs):
        # 1. REFERANS TARİH (BUGÜN)
        today = timezone.now().date()
        self.stdout.write(self.style.WARNING(f'Referans Tarih (Bugün): {today} baz alınarak veri üretiliyor...'))

        # 2. TEMİZLİK (Eski verileri sil)
        self.stdout.write('Eski veriler temizleniyor...')
        # Sıralama önemli: Önce child (bağımlı) tablolar silinmeli
        WorkoutResult.objects.all().delete()
        Workout.objects.all().delete()
        Program.objects.all().delete()
        User.objects.filter(email__contains='@test.com').delete()

        # 3. KULLANICI OLUŞTURMA (BERKAN & AYŞENAZ)
        users_data = [
            {
                "first": "Berkan",
                "last": "Standart",
                "is_premium": False,
                "premium_type": None,
                "premium_expires_at": None,
                "days": [1, 3, 5], # Salı, Perşembe, Cumartesi
                "max_dist": 10.0,
                "pace": 360,
                "gender": "male",
                "weight": 80,
                "height": 182,
                "dob": datetime.date(2001, 3, 26) # 26 Mart 2001
            },
            {
                "first": "Aysenaz",
                "last": "Premium",
                "is_premium": True,
                "premium_type": "yearly",
                "premium_expires_at": timezone.now() + datetime.timedelta(days=330), # ~11 ay kaldı
                "days": [0, 2, 4, 6], # Pzt, Çar, Cuma, Pazar
                "max_dist": 21.1,
                "pace": 310,
                "gender": "female",
                "weight": 58,
                "height": 168,
                "dob": datetime.date(2001, 2, 19) # 19 Şubat 2001
            },
        ]

        created_users = []

        for u in users_data:
            email = f"{u['first'].lower()}@test.com"
            
            user = User.objects.create_user(
                username=u['first'].lower(),
                email=email,
                password='123', 
                first_name=u['first'],
                last_name=u['last']
            )
            
            # Yeni alanlar set ediliyor
            user.gender = u['gender']
            user.weight = u['weight']
            user.height = u['height']
            user.is_premium = u['is_premium']
            user.premium_type = u['premium_type']
            user.premium_expires_at = u['premium_expires_at']
            user.preferred_running_days = u['days']
            user.max_runned_distance = u['max_dist']
            user.current_pace = u['pace']
            user.date_of_birth = u['dob'] # <-- DOĞUM TARİHİ EKLENDİ
            
            user.save()
            created_users.append(user)
            premium_info = f"{user.premium_type}, expires: {user.premium_expires_at}" if user.is_premium else "Free"
            self.stdout.write(f"Kullanıcı oluşturuldu: {user.first_name} ({premium_info})")

        # 4. PROGRAM & WORKOUT OLUŞTURMA
        for user in created_users:
            # Premium kullanıcıya daha uzun, standart kullanıcıya daha kısa program
            weeks = 10 if user.is_premium else 6
            title = "Yarı Maraton Hazırlık" if user.is_premium else "5K Hızlandırma"
            
            start_date = today - datetime.timedelta(weeks=2) # 2 hafta önce başlamış olsunlar
            end_date = start_date + datetime.timedelta(weeks=weeks)
            
            # Program oluşturma
            program = Program.objects.create(
                user=user,
                title=title,
                description=f"{user.first_name} için otomatik oluşturulan plan.",
                goal="Form tutmak",
                start_date=start_date,
                end_date=end_date,
                duration_weeks=weeks,
                running_days=user.preferred_running_days, 
                total_workouts_count=weeks * len(user.preferred_running_days),
                status='active' 
            )

            current_day = start_date
            active_days = user.preferred_running_days 

            while current_day <= end_date:
                # Eğer o gün, kullanıcının koşu günlerinden biriyse (0=Pzt, 6=Paz)
                if current_day.weekday() in active_days:
                    
                    if current_day.weekday() >= 5: # Hafta sonuysa uzun koşu
                        w_type = 'long'
                        duration = 60 if user.is_premium else 45
                        dist = 12.0 if user.is_premium else 8.0
                    else:
                        w_type = random.choice(['easy', 'tempo', 'interval'])
                        duration = 45 if user.is_premium else 30
                        dist = 6.0 if user.is_premium else 5.0

                    titles = {'easy': "Hafif Koşu", 'tempo': "Tempo Koşusu", 'interval': "İnterval", 'long': "Uzun Koşu"}
                    target_pace = user.current_pace - 30 if w_type == 'tempo' else user.current_pace

                    is_past = current_day < today
                    is_today = current_day == today
                    
                    status = 'scheduled'
                    is_completed = False
                    
                    if is_past:
                        if random.random() > 0.15: # %85 ihtimalle tamamlamış olsunlar
                            status = 'completed'
                            is_completed = True
                        else:
                            status = 'missed'
                            is_completed = False
                    
                    if is_today:
                        status = 'scheduled'
                        is_completed = False

                    # 1. Workout Kaydet
                    workout = Workout.objects.create(
                        program=program,
                        title=titles[w_type],
                        workout_type=w_type,
                        scheduled_date=current_day,
                        planned_duration=duration,
                        planned_distance=dist,
                        target_pace_seconds=target_pace,
                        status=status,
                        is_completed=is_completed
                    )

                    # 2. Sonuç Kaydet (Sinyalleri Tetikler!)
                    if is_completed:
                        completed_time = datetime.time(8, 0, 0)
                        completed_datetime = timezone.make_aware(
                            datetime.datetime.combine(current_day, completed_time)
                        )

                        WorkoutResult.objects.create(
                            workout=workout,
                            user=user,
                            actual_distance=dist + random.uniform(-0.5, 0.5),
                            actual_duration=duration + random.randint(-5, 5),
                            completed_at=completed_datetime,
                            feeling='normal',
                            user_notes="Harika bir antrenmandı!" if user.is_premium else "Biraz yoruldum."
                        )

                current_day += datetime.timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'\n✅ BAŞARILI! Berkan ve Ayşenaz verileri (doğum tarihleriyle birlikte) yüklendi.'))