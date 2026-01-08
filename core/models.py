import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

# 1. USER MODEL (Aynı kalıyor, sadece importları düzenledim)
class User(AbstractUser):
    class Gender(models.TextChoices):
        MALE = 'male', _('Male')
        FEMALE = 'female', _('Female')
        OTHER = 'other', _('Other')

    class ExperienceLevel(models.TextChoices):
        BEGINNER = 'beginner', _('Beginner')
        INTERMEDIATE = 'intermediate', _('Intermediate')
        ADVANCED = 'advanced', _('Advanced')

    class PreferredDistance(models.TextChoices):
        FIVE_K = '5K', _('5K')
        TEN_K = '10K', _('10K')
        HALF_MARATHON = 'half_marathon', _('Half Marathon')
        MARATHON = 'marathon', _('Marathon')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_image = models.URLField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)

    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)
    weight = models.FloatField(help_text="kg", blank=True, null=True)
    height = models.IntegerField(help_text="cm", blank=True, null=True)

    experience_level = models.CharField(max_length=20, choices=ExperienceLevel.choices, default=ExperienceLevel.BEGINNER)
    preferred_distance = models.CharField(max_length=20, choices=PreferredDistance.choices, blank=True, null=True)
    current_max_distance = models.FloatField(default=0.0)
    current_pace = models.IntegerField(default=360, help_text="Saniye/km")
    weekly_goal = models.IntegerField(default=3)

    total_workouts = models.IntegerField(default=0)
    total_distance = models.FloatField(default=0.0)
    total_time = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)

    push_token = models.CharField(max_length=255, blank=True, null=True)
    timezone = models.CharField(max_length=50, default='UTC')
    preferred_reminder_time = models.TimeField(default='09:00:00')

    notification_workout_reminder = models.BooleanField(default=True)
    notification_weekly_report = models.BooleanField(default=True)
    notification_achievements = models.BooleanField(default=True)
    notification_plan_updates = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email.split('@')[0]
            if User.objects.filter(username=self.username).exists():
                 self.username = f"{self.username}_{uuid.uuid4().hex[:8]}"
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        if not self.current_pace: return "0:00"
        m, s = divmod(self.current_pace, 60)
        return f"{m}:{s:02d}"


# 2. PROGRAM MODEL (SADELEŞTİRİLDİ)
class Program(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Active')       # Sadece bir tane olabilir
        INACTIVE = 'inactive', _('Inactive') # Arşivlenmiş/İptal edilmiş
        COMPLETED = 'completed', _('Completed')

    class Difficulty(models.TextChoices):
        BEGINNER = 'beginner', _('Beginner')
        INTERMEDIATE = 'intermediate', _('Intermediate')
        ADVANCED = 'advanced', _('Advanced')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='programs')
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    goal = models.CharField(max_length=255)

    start_date = models.DateField()
    end_date = models.DateField()
    duration_weeks = models.IntegerField()

    difficulty = models.CharField(max_length=20, choices=Difficulty.choices)
    workouts_per_week = models.IntegerField()
    
    total_workouts_count = models.IntegerField(default=0)
    completed_workouts_count = models.IntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # AI Context alanları KALDIRILDI ❌

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    @property
    def current_week_calculated(self):
        today = timezone.now().date()
        if today < self.start_date: return 0
        delta = today - self.start_date
        week_num = (delta.days // 7) + 1
        return min(week_num, self.duration_weeks)

    @property
    def progress_percent(self):
        if self.total_workouts_count == 0: return 0
        return int((self.completed_workouts_count / self.total_workouts_count) * 100)


# 3. WORKOUT MODEL (SADELEŞTİRİLDİ)
class Workout(models.Model):
    class WorkoutType(models.TextChoices):
        TEMPO = 'tempo', _('Tempo Run')
        EASY = 'easy', _('Easy Run')
        INTERVAL = 'interval', _('Intervals')
        LONG = 'long', _('Long Run')
        # REST tipi KALDIRILDI ❌

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', _('Scheduled')
        COMPLETED = 'completed', _('Completed')
        MISSED = 'missed', _('Missed')
        # SKIPPED tipi KALDIRILDI ❌

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='workouts')
    
    title = models.CharField(max_length=255)
    workout_type = models.CharField(max_length=20, choices=WorkoutType.choices)
    
    scheduled_date = models.DateField()
    day_of_week = models.IntegerField(blank=True, null=True) # 0=Mon

    planned_distance = models.FloatField(default=0.0)
    planned_duration = models.IntegerField(default=0) # Dakika
    target_pace_seconds = models.IntegerField(blank=True, null=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    is_completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.title} - {self.scheduled_date}"

    def save(self, *args, **kwargs):
        if self.scheduled_date:
            self.day_of_week = self.scheduled_date.weekday()
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        if not self.target_pace_seconds: return "-"
        m, s = divmod(self.target_pace_seconds, 60)
        return f"{m}:{s:02d}"


# 4. WORKOUT RESULT (Değişiklik yok, sadece importlar için koydum)
class WorkoutResult(models.Model):
    class Feeling(models.TextChoices):
        HARD = 'hard', _('Zor')
        NORMAL = 'normal', _('Normal')
        EASY = 'easy', _('Kolay')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='results')
    workout = models.OneToOneField(Workout, on_delete=models.SET_NULL, null=True, blank=True, related_name='result')

    actual_distance = models.FloatField()
    actual_duration = models.IntegerField()
    actual_pace_seconds = models.IntegerField(default=0)
    calories_burned = models.IntegerField(default=0)

    feeling = models.CharField(max_length=10, choices=Feeling.choices, default=Feeling.NORMAL)
    user_notes = models.TextField(blank=True)
    completed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-completed_at']

    def save(self, *args, **kwargs):
        if self.actual_distance > 0 and self.actual_duration > 0:
            self.actual_pace_seconds = int((self.actual_duration * 60) / self.actual_distance)
        else:
            self.actual_pace_seconds = 0
            
        if self.actual_distance > 0:
            current_weight = self.user.weight if self.user.weight else 70.0
            burn_factor = 0.97 if self.user.gender == 'female' else 1.05
            self.calories_burned = int(self.actual_distance * current_weight * burn_factor)
        
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        if not self.actual_pace_seconds: return "-"
        m, s = divmod(self.actual_pace_seconds, 60)
        return f"{m}:{s:02d}"
    


# 5. ACHIEVEMENT
class Achievement(models.Model):
    class AchievementType(models.TextChoices):
        DISTANCE = 'distance', _('Mesafe Rozeti')
        WORKOUT_COUNT = 'workout_count', _('Antrenman Sayısı') # <--- BU EKLENDİ
        STREAK = 'streak', _('Seri Rozeti')
        PACE = 'pace', _('Hız Rozeti')
        COMPLETION = 'completion', _('Tamamlama Rozeti')
        SPECIAL = 'special', _('Özel Rozet')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    
    title = models.CharField(max_length=255)       # "Maratoncu Ruhu"
    description = models.TextField()               # "Toplamda 42km koşuyu tamamladın."
    achievement_type = models.CharField(max_length=50, choices=AchievementType.choices)

    # --- UI İÇİN GÖRSEL VERİ ---
    # React Native'deki Ionicon ismi (Örn: 'trophy', 'flame', 'medal')
    icon_name = models.CharField(max_length=50, default='trophy')
    # Hex kodu (Örn: '#FFD700')
    icon_color = models.CharField(max_length=20, default='#FFD700')

    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-earned_at'] # En son kazanılan en üstte

    def __str__(self):
        return f"{self.user.email} - {self.title}"


# 6. NOTIFICATION
class Notification(models.Model):
    class NotificationType(models.TextChoices):
        REMINDER = 'reminder', _('Hatırlatıcı')     # "Bugün antrenmanın var!"
        ACHIEVEMENT = 'achievement', _('Tebrikler') # "Yeni rozet kazandın!"
        SYSTEM = 'system', _('Sistem/AI')           # "Programın güncellendi."
        INFO = 'info', _('Bilgi')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=50, choices=NotificationType.choices)

    is_read = models.BooleanField(default=False)
    
    # --- YÖNLENDİRME (DEEP LINKING MANTIĞI) ---
    # Bildirime tıklayınca kullanıcıyı ilgili antrenmana götürmek için:
    related_workout = models.ForeignKey('Workout', on_delete=models.SET_NULL, null=True, blank=True)
    # Bildirime tıklayınca program detayına götürmek için:
    related_program = models.ForeignKey('Program', on_delete=models.SET_NULL, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.user.email})"