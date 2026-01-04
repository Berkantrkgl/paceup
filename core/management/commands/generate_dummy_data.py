import random
import datetime
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import User, Program, Workout, WorkoutResult

class Command(BaseCommand):
    help = 'Yeni Model yapısına uygun dummy veri basar (Sinyallerle otomatik hesaplama).'

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
        # Sinyallerin tetiklenip gereksiz işlem yapmasını önlemek için direkt delete() kullanıyoruz
        WorkoutResult.objects.all().delete()
        Workout.objects.all().delete()
        Program.objects.all().delete()
        # Sadece dummy mailleri temizle, admin kalsın
        User.objects.filter(email__contains='@gmail.com').delete()

        # 3. KULLANICI OLUŞTURMA
        users_data = [
            {"first": "Ahmet", "last": "Yılmaz", "level": "advanced", "goal": 5},
            {"first": "Ayşe", "last": "Demir", "level": "intermediate", "goal": 4},
            {"first": "Mehmet", "last": "Kaya", "level": "beginner", "goal": 3},
            {"first": "Zeynep", "last": "Çelik", "level": "beginner", "goal": 2},
        ]

        created_users = []

        for i, u in enumerate(users_data):
            first_clean = self.clean_turkish_chars(u['first'].lower())
            last_clean = self.clean_turkish_chars(u['last'].lower())
            email = f"{first_clean}.{last_clean}@gmail.com"
            
            # Unique email garantisi
            if User.objects.filter(email=email).exists():
                email = f"{first_clean}.{last_clean}{i}@gmail.com"

            user = User.objects.create_user(
                username=email.split('@')[0], # Model save() bunu handle ediyor ama explicit iyidir
                email=email,
                password='boom',
                first_name=u['first'],
                last_name=u['last']
            )
            
            # Fiziksel özellikler
            user.gender = random.choice(['male', 'female'])
            user.weight = random.randint(55, 95)
            user.height = random.randint(160, 190)
            
            # Koşu Profili (PACE ARTIK SANİYE CİNSİNDEN)
            user.experience_level = u['level']
            user.weekly_goal = u['goal']
            user.current_pace = 330 # 5:30 dk/km (Ortalama başlangıç)
            
            user.save()
            created_users.append(user)
            self.stdout.write(f"Kullanıcı oluşturuldu: {user.email}")

        # 4. PROGRAM & WORKOUT OLUŞTURMA
        program_templates = [
            {"title": "5K'ya Başlangıç", "weeks": 8, "type": "beginner"},
            {"title": "10K Hızlandırma", "weeks": 10, "type": "intermediate"},
            {"title": "Yarı Maraton Hazırlık", "weeks": 12, "type": "advanced"},
        ]

        for user in created_users:
            template = random.choice(program_templates)
            
            # Programın başlangıcını geçmişe atıyoruz (Grafikler dolu gözüksün)
            weeks_ago = random.randint(3, 5) 
            start_date = today - datetime.timedelta(weeks=weeks_ago)
            end_date = start_date + datetime.timedelta(weeks=template['weeks'])
            
            program = Program.objects.create(
                user=user,
                title=template['title'],
                description=f"{user.first_name} için AI tarafından oluşturulan plan.",
                goal=template['title'],
                start_date=start_date,
                end_date=end_date,
                duration_weeks=template['weeks'],
                # current_week ARTIK YOK (Property hesaplıyor)
                difficulty=user.experience_level,
                workouts_per_week=user.weekly_goal,
                total_workouts_count=template['weeks'] * user.weekly_goal,
                status=Program.Status.ACTIVE,
                ai_generated=True
            )

            # Döngü ile gün gün antrenman basıyoruz
            current_day = start_date
            while current_day <= end_date:
                # Haftalık hedefe göre antrenman sıklığını ayarla
                step = 7 // max(1, user.weekly_goal)
                
                if (current_day - start_date).days % step == 0:
                    # Antrenman Tipi Seçimi
                    w_type = random.choice(['easy', 'tempo', 'interval', 'long'])
                    titles = {'easy': "Hafif Koşu", 'tempo': "Tempo Koşusu", 'interval': "İnterval", 'long': "Uzun Koşu"}
                    
                    # Target Pace Belirleme (Saniye cinsinden)
                    # Tempo: 5:00 (300sn), Easy: 6:00 (360sn) gibi
                    target_pace_sec = random.choice([300, 330, 360, 400])

                    # Geçmiş günler mi?
                    is_past_or_today = current_day <= today
                    
                    status = Workout.Status.SCHEDULED
                    is_completed = False
                    
                    # Eğer geçmiş günse %80 ihtimalle tamamlandı yap
                    if is_past_or_today and random.random() > 0.2:
                        status = Workout.Status.COMPLETED
                        is_completed = True
                    elif is_past_or_today:
                        status = Workout.Status.SKIPPED

                    # WORKOUT OLUŞTUR
                    workout = Workout.objects.create(
                        program=program,
                        title=titles[w_type],
                        workout_type=w_type,
                        scheduled_date=current_day,
                        # day_of_week Model.save() içinde otomatik hesaplanıyor
                        planned_duration=random.choice([30, 45, 60]),
                        planned_distance=random.choice([3.0, 5.0, 7.0, 10.0]),
                        target_pace_seconds=target_pace_sec,
                        status=status,
                        is_completed=is_completed
                    )

                    # WORKOUT RESULT (Eğer tamamlandıysa)
                    if is_completed:
                        # Biraz sapma ekleyelim (Gerçekçilik için)
                        actual_dist = workout.planned_distance + random.uniform(-0.5, 0.5)
                        actual_dur = workout.planned_duration + random.randint(-2, 5)
                        
                        # Completed At: O günün sabah 07:30'u
                        completed_time = datetime.time(7, 30, 0)
                        completed_datetime = timezone.make_aware(
                            datetime.datetime.combine(current_day, completed_time)
                        )

                        # Result oluştur (Sinyaller User Stats'ı otomatik güncelleyecek!)
                        # Not: Pace ve Kalori model.save() içinde otomatik hesaplanacak.
                        WorkoutResult.objects.create(
                            workout=workout,
                            user=user, # YENİ ALAN: User'ı eklememiz şart
                            actual_distance=max(1.0, round(actual_dist, 2)),
                            actual_duration=max(10, int(actual_dur)),
                            completed_at=completed_datetime,
                            feeling=random.choice(['easy', 'normal', 'hard']),
                            user_notes="Harika bir sabah koşusuydu."
                        )

                current_day += datetime.timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'\nBAŞARILI! Yeni yapıya uygun veriler {today} tarihine göre oluşturuldu.'))