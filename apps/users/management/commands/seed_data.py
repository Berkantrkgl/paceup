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

        # 3. KULLANICI OLUŞTURMA (AHMET & MEHMET)
        users_data = [
            {"first": "Ahmet", "last": "Yilmaz", "level": "advanced", "goal": 4},
            {"first": "Mehmet", "last": "Demir", "level": "beginner", "goal": 3},
        ]

        created_users = []

        for u in users_data:
            email = f"{u['first'].lower()}@test.com"
            
            # create_user yardımcı metodunu kullanıyoruz
            user = User.objects.create_user(
                username=u['first'].lower(),
                email=email,
                password='123', 
                first_name=u['first'],
                last_name=u['last']
            )
            
            # Ekstra alanları manuel set ediyoruz
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
            
            start_date = today - datetime.timedelta(weeks=3)
            end_date = start_date + datetime.timedelta(weeks=template['weeks'])
            
            # Program oluşturma
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
                status='active' # Enum yerine string kullanmak daha güvenli olabilir (import hatası riskine karşı)
            )

            current_day = start_date
            active_days = schedule_patterns.get(user.weekly_goal, [1, 3, 5]) 

            while current_day <= end_date:
                if current_day.weekday() in active_days:
                    
                    if current_day.weekday() >= 5: 
                        w_type = 'long'
                        duration = 60
                        dist = 10.0
                    else:
                        w_type = random.choice(['easy', 'tempo', 'interval'])
                        duration = 45
                        dist = 5.0

                    titles = {'easy': "Hafif Koşu", 'tempo': "Tempo Koşusu", 'interval': "İnterval", 'long': "Uzun Koşu"}
                    target_pace = 300 if w_type == 'tempo' else 360

                    is_past = current_day < today
                    is_today = current_day == today
                    
                    status = 'scheduled'
                    is_completed = False
                    
                    if is_past:
                        if random.random() > 0.2: 
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
                            actual_distance=dist, 
                            actual_duration=duration,
                            completed_at=completed_datetime,
                            feeling='normal',
                            user_notes="Otomatik veri."
                        )

                current_day += datetime.timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'\n✅ BAŞARILI! Ahmet ve Mehmet için veriler yüklendi.'))