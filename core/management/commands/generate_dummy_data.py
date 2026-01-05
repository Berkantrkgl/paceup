import random
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, Program, Workout, WorkoutResult

class Command(BaseCommand):
    help = 'Yeni Model yapısına uygun, gerçekçi dummy veriler basar.'

    def clean_turkish_chars(self, text):
        translation_table = str.maketrans({
            'ş': 's', 'Ş': 's', 'ı': 'i', 'I': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g',
            'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c'
        })
        return text.translate(translation_table)

    def handle(self, *args, **kwargs):
        # 1. REFERANS TARİH (BUGÜN)
        today = timezone.now().date()
        self.stdout.write(self.style.WARNING(f'Referans Tarih (Bugün): {today} baz alınarak veri üretiliyor...'))

        # 2. TEMİZLİK
        self.stdout.write('Eski veriler temizleniyor...')
        WorkoutResult.objects.all().delete()
        Workout.objects.all().delete()
        Program.objects.all().delete()
        User.objects.filter(email__contains='@gmail.com').delete()

        # 3. KULLANICI OLUŞTURMA (SADECE 2 KİŞİ)
        # Biri ileri seviye, biri başlangıç
        users_data = [
            {"first": "Barış", "last": "Özdemir", "level": "advanced", "goal": 4},   # Haftada 4 gün
            {"first": "Selin", "last": "Yılmaz", "level": "beginner", "goal": 3},    # Haftada 3 gün
        ]

        created_users = []

        for i, u in enumerate(users_data):
            first_clean = self.clean_turkish_chars(u['first'].lower())
            last_clean = self.clean_turkish_chars(u['last'].lower())
            email = f"{first_clean}.{last_clean}@gmail.com"
            
            if User.objects.filter(email=email).exists():
                email = f"{first_clean}.{last_clean}{i}@gmail.com"

            user = User.objects.create_user(
                username=email.split('@')[0],
                email=email,
                password='boom', # Şifre: boom
                first_name=u['first'],
                last_name=u['last']
            )
            
            user.gender = random.choice(['male', 'female'])
            user.weight = random.randint(55, 85)
            user.height = random.randint(165, 185)
            user.experience_level = u['level']
            user.weekly_goal = u['goal']
            user.current_pace = 300 if u['level'] == 'advanced' else 390 # 5:00 vs 6:30
            
            user.save()
            created_users.append(user)
            self.stdout.write(f"Kullanıcı oluşturuldu: {user.email} (Hedef: {u['goal']} gün/hafta)")

        # 4. PROGRAM & WORKOUT OLUŞTURMA
        program_templates = [
            {"title": "10K Hızlandırma", "weeks": 10, "type": "advanced"},
            {"title": "İlk 5K Programım", "weeks": 8, "type": "beginner"},
        ]

        # Antrenman Günleri Şablonu (Pazartesi=0 ... Pazar=6)
        # Haftada 3 gün: Salı(1), Perşembe(3), Cumartesi(5)
        # Haftada 4 gün: Pzt(0), Çarş(2), Cuma(4), Pazar(6)
        schedule_patterns = {
            3: [1, 3, 5], 
            4: [0, 2, 4, 6] 
        }

        for idx, user in enumerate(created_users):
            # User'a uygun template seç
            template = program_templates[0] if user.experience_level == 'advanced' else program_templates[1]
            
            # Program başlangıcını biraz geriye atıyoruz ki veriler dolsun
            # Ama program henüz bitmemiş olsun (Bugün ortalarında olsun)
            weeks_past = 4 
            start_date = today - datetime.timedelta(weeks=weeks_past)
            end_date = start_date + datetime.timedelta(weeks=template['weeks'])
            
            program = Program.objects.create(
                user=user,
                title=template['title'],
                description=f"{user.first_name} için hazırlanan kişisel antrenman planı.",
                goal=template['title'],
                start_date=start_date,
                end_date=end_date,
                duration_weeks=template['weeks'],
                difficulty=user.experience_level,
                workouts_per_week=user.weekly_goal,
                # Toplam antrenman sayısı = Hafta * Haftalık Hedef
                total_workouts_count=template['weeks'] * user.weekly_goal,
                status=Program.Status.ACTIVE,
                ai_generated=True
            )

            # --- ANTRENMANLARI GÜNLERE YAYMA ---
            current_day = start_date
            active_days = schedule_patterns.get(user.weekly_goal, [1, 3, 5]) # Fallback 3 gün

            while current_day <= end_date:
                # Sadece belirlenen günlerde antrenman olsun
                if current_day.weekday() in active_days:
                    
                    # Antrenman Tipi (Hafta sonu Uzun Koşu)
                    if current_day.weekday() >= 5: # Cmt veya Pazar
                        w_type = 'long'
                        duration = random.choice([60, 75, 90])
                        dist = random.choice([8.0, 10.0, 12.0])
                    else:
                        w_type = random.choice(['easy', 'tempo', 'interval'])
                        duration = random.choice([30, 45])
                        dist = random.choice([3.0, 4.0, 5.0])

                    titles = {'easy': "Hafif Koşu", 'tempo': "Tempo Koşusu", 'interval': "İnterval", 'long': "Uzun Koşu"}
                    target_pace = 300 if w_type == 'tempo' else 360 # Tempo hızlı

                    # Durum Belirleme (Geçmiş mi Gelecek mi?)
                    is_past = current_day < today
                    is_today = current_day == today
                    
                    status = Workout.Status.SCHEDULED
                    is_completed = False
                    
                    # Geçmişse %85 ihtimalle yapılmıştır
                    if is_past:
                        if random.random() > 0.15: 
                            status = Workout.Status.COMPLETED
                            is_completed = True
                        else:
                            status = Workout.Status.SKIPPED
                    
                    # Bugünse henüz yapılmamış olsun (Scheduled kalsın)
                    if is_today:
                        status = Workout.Status.SCHEDULED
                        is_completed = False

                    # Gelecekse zaten Scheduled kalacak.

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

                    # 2. Eğer Tamamlandıysa Result Oluştur
                    # (Sinyaller User Stats ve Streak'i buradan güncelleyecek)
                    if is_completed:
                        # Gerçekçi sapmalar
                        actual_dist = dist + random.uniform(-0.2, 0.4)
                        actual_dur = duration + random.randint(-2, 3)
                        
                        completed_time = datetime.time(7, 30, 0)
                        completed_datetime = timezone.make_aware(
                            datetime.datetime.combine(current_day, completed_time)
                        )

                        WorkoutResult.objects.create(
                            workout=workout,
                            user=user,
                            actual_distance=max(1.0, round(actual_dist, 2)),
                            actual_duration=max(10, int(actual_dur)),
                            completed_at=completed_datetime,
                            feeling=random.choice(['easy', 'normal', 'hard']),
                            user_notes="Güzel bir antrenmandı."
                        )

                # Sonraki güne geç
                current_day += datetime.timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'\nBAŞARILI! 2 kullanıcı için gerçekçi programlar oluşturuldu.'))