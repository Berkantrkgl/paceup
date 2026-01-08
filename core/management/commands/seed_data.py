import random
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, Program, Workout, WorkoutResult

class Command(BaseCommand):
    help = 'Yeni Model yapısına uygun, temizlenmiş dummy veriler basar.'

    def handle(self, *args, **kwargs):
        # 1. REFERANS TARİH (BUGÜN)
        today = timezone.now().date()
        self.stdout.write(self.style.WARNING(f'Referans Tarih (Bugün): {today} baz alınarak veri üretiliyor...'))

        # 2. TEMİZLİK (Eski verileri sil)
        self.stdout.write('Eski veriler temizleniyor...')
        WorkoutResult.objects.all().delete()
        Workout.objects.all().delete()
        Program.objects.all().delete()
        User.objects.filter(email__contains='@test.com').delete()

        # 3. KULLANICI OLUŞTURMA (AHMET & MEHMET)
        users_data = [
            {"first": "Ahmet", "last": "Yilmaz", "level": "advanced", "goal": 4},   # Haftada 4 gün
            {"first": "Mehmet", "last": "Demir", "level": "beginner", "goal": 3},    # Haftada 3 gün
        ]

        created_users = []

        for u in users_data:
            email = f"{u['first'].lower()}@test.com"
            
            user = User.objects.create_user(
                username=u['first'].lower(),
                email=email,
                password='123', # Basit şifre
                first_name=u['first'],
                last_name=u['last']
            )
            
            user.gender = 'male'
            user.weight = random.randint(70, 85)
            user.height = random.randint(175, 185)
            user.experience_level = u['level']
            user.weekly_goal = u['goal']
            user.current_pace = 300 if u['level'] == 'advanced' else 390 
            
            user.save()
            created_users.append(user)
            self.stdout.write(f"Kullanıcı oluşturuldu: {user.email} (Şifre: 123)")

        # 4. PROGRAM & WORKOUT OLUŞTURMA
        program_templates = [
            {"title": "10K Hızlandırma", "weeks": 10},
            {"title": "5K Başlangıç", "weeks": 8},
        ]

        # Antrenman Günleri (Pazartesi=0 ... Pazar=6)
        schedule_patterns = {
            3: [1, 3, 5],    # Salı, Perşembe, Cmt
            4: [0, 2, 4, 6]  # Pzt, Çar, Cuma, Paz
        }

        for idx, user in enumerate(created_users):
            template = program_templates[0] if user.experience_level == 'advanced' else program_templates[1]
            
            # Programı 3 hafta önce başlatıyoruz (Veri oluşsun diye)
            start_date = today - datetime.timedelta(weeks=3)
            end_date = start_date + datetime.timedelta(weeks=template['weeks'])
            
            program = Program.objects.create(
                user=user,
                title=template['title'],
                description=f"{user.first_name} için otomatik oluşturulan plan.",
                goal="Form tutmak",
                start_date=start_date,
                end_date=end_date,
                duration_weeks=template['weeks'],
                difficulty=user.experience_level,
                workouts_per_week=user.weekly_goal,
                total_workouts_count=template['weeks'] * user.weekly_goal,
                status=Program.Status.ACTIVE # Sadece tek bir aktif plan
            )

            # --- ANTRENMANLARI GÜNLERE YAYMA ---
            current_day = start_date
            active_days = schedule_patterns.get(user.weekly_goal, [1, 3, 5]) 

            while current_day <= end_date:
                # Sadece belirlenen günlerde antrenman olsun
                if current_day.weekday() in active_days:
                    
                    # Antrenman Tipi
                    if current_day.weekday() >= 5: # Hafta sonu
                        w_type = 'long'
                        duration = 60
                        dist = 10.0
                    else:
                        w_type = random.choice(['easy', 'tempo', 'interval'])
                        duration = 45
                        dist = 5.0

                    titles = {'easy': "Hafif Koşu", 'tempo': "Tempo Koşusu", 'interval': "İnterval", 'long': "Uzun Koşu"}
                    
                    # Pace Hesabı
                    target_pace = 300 if w_type == 'tempo' else 360

                    # Statü Belirleme
                    is_past = current_day < today
                    is_today = current_day == today
                    
                    status = Workout.Status.SCHEDULED # Varsayılan
                    is_completed = False
                    
                    # Geçmiş Antrenmanlar
                    if is_past:
                        # %80 ihtimalle yapılmış olsun
                        if random.random() > 0.2: 
                            status = Workout.Status.COMPLETED
                            is_completed = True
                        else:
                            # Yapılmamışsa MISSED (Eskiden SKIPPED idi, artık MISSED)
                            status = Workout.Status.MISSED
                            is_completed = False
                    
                    # Bugün (Henüz yapılmamış varsayıyoruz)
                    if is_today:
                        status = Workout.Status.SCHEDULED
                        is_completed = False

                    # 1. Workout Oluştur
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

                    # 2. Tamamlandıysa Result (Log) Oluştur
                    if is_completed:
                        completed_time = datetime.time(8, 0, 0)
                        completed_datetime = timezone.make_aware(
                            datetime.datetime.combine(current_day, completed_time)
                        )

                        WorkoutResult.objects.create(
                            workout=workout,
                            user=user,
                            actual_distance=dist, # Tam planlandığı gibi koşmuş varsayalım
                            actual_duration=duration,
                            completed_at=completed_datetime,
                            feeling='normal',
                            user_notes="Otomatik veri."
                        )
                        # Not: Sinyaller (signals.py) burada devreye girip User istatistiklerini güncelleyecek.

                # Sonraki güne geç
                current_day += datetime.timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'\n✅ BAŞARILI! Ahmet ve Mehmet için veriler yüklendi.'))