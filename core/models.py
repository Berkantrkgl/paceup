import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

# 1. USER MODEL (Custom)
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

    # --- KİMLİK & HESAP BİLGİLERİ ---
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True) # Giriş için kullanılacak ana alan
    # username: AbstractUser'dan geliyor, save metodunda otomatik dolduracağız.
    
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_image = models.URLField(blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)

    # --- FİZİKSEL BİLGİLER ---
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)
    weight = models.FloatField(help_text="kg", blank=True, null=True)
    height = models.IntegerField(help_text="cm", blank=True, null=True)

    # --- KOŞU PROFİLİ (AI Context) ---
    experience_level = models.CharField(max_length=20, choices=ExperienceLevel.choices, default=ExperienceLevel.BEGINNER)
    preferred_distance = models.CharField(max_length=20, choices=PreferredDistance.choices, blank=True, null=True)
    current_max_distance = models.FloatField(default=0.0, help_text="Tek seferde koşulan maksimum mesafe (km)")
    
    # GÜNCELLEME: Artık saniye cinsinden integer (Örn: 330 = 5:30 min/km)
    current_pace = models.IntegerField(
        default=360, 
        help_text="Ortalama tempo (saniye/km). Örn: 360 saniye = 6:00 dk/km"
    )
    
    weekly_goal = models.IntegerField(default=3, help_text="Haftalık hedeflenen antrenman sayısı")

    # --- İSTATİSTİKLER (Denormalized - Sinyallerle dolacak) ---
    total_workouts = models.IntegerField(default=0)
    total_distance = models.FloatField(default=0.0)
    total_time = models.IntegerField(default=0, help_text="Dakika cinsinden toplam süre")
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)

    # --- AYARLAR & BİLDİRİMLER ---
    push_token = models.CharField(max_length=255, blank=True, null=True)
    timezone = models.CharField(max_length=50, default='UTC')
    preferred_reminder_time = models.TimeField(default='09:00:00', help_text="Günlük hatırlatma saati")

    notification_workout_reminder = models.BooleanField(default=True)
    notification_weekly_report = models.BooleanField(default=True)
    notification_achievements = models.BooleanField(default=True)
    notification_plan_updates = models.BooleanField(default=True)

    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Auth Ayarları
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username'] # create_superuser komutu için gerekli sadece

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        # Eğer username boş gelirse email'den üret
        if not self.username:
            self.username = self.email.split('@')[0]
            # Eğer bu username doluyse sonuna random ekle (opsiyonel basit çözüm)
            if User.objects.filter(username=self.username).exists():
                 self.username = f"{self.username}_{uuid.uuid4().hex[:8]}"
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        """Frontend için '5:30' formatında string döner"""
        if not self.current_pace:
            return "0:00"
        minutes = self.current_pace // 60
        seconds = self.current_pace % 60
        return f"{minutes}:{seconds:02d}"
    


# 2. PROGRAM MODEL
class Program(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Active')
        COMPLETED = 'completed', _('Completed')
        PAUSED = 'paused', _('Paused')
        CANCELLED = 'cancelled', _('Cancelled') # Planı yarıda bırakırsa

    class Difficulty(models.TextChoices):
        BEGINNER = 'beginner', _('Beginner')
        INTERMEDIATE = 'intermediate', _('Intermediate')
        ADVANCED = 'advanced', _('Advanced')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='programs')
    
    # --- PLAN DETAYLARI ---
    title = models.CharField(max_length=255, help_text="Örn: 10K Hazırlık - Hız Odaklı")
    description = models.TextField(blank=True, help_text="AI tarafından oluşturulan plan özeti")
    goal = models.CharField(max_length=255, help_text="Örn: 10K'yı 50 dakika altında koşmak")

    # --- ZAMANLAMA ---
    start_date = models.DateField(help_text="Planın başladığı gün")
    end_date = models.DateField(help_text="Planın biteceği gün")
    duration_weeks = models.IntegerField(help_text="Plan kaç hafta sürüyor?")
    # NOT: current_week alanını sildik, aşağıda property olarak hesaplayacağız.

    # --- İSTATİSTİKLER (Denormalized) ---
    # Her antrenman bittiğinde Program tablosunu sürekli count() ile yormamak için sayıları burada tutuyoruz.
    difficulty = models.CharField(max_length=20, choices=Difficulty.choices)
    workouts_per_week = models.IntegerField(help_text="Haftalık antrenman sayısı")
    
    total_workouts_count = models.IntegerField(default=0)
    completed_workouts_count = models.IntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

    # --- AI CONTEXT ---
    # Chatbot'un bu planı oluştururken kullandığı parametreleri ve konuşma geçmişini saklıyoruz.
    # Böylece kullanıcı "Planı biraz zorlaştır" dediğinde AI neyi değiştireceğini bilir.
    ai_generated = models.BooleanField(default=True)
    ai_conversation_history = models.JSONField(default=list, blank=True, help_text="LangGraph/Chat history")
    
    # Kullanıcı planı oluştururken ne istemişti? (Prompt verisi)
    # Örn: {"days": ["Mon", "Wed", "Sat"], "focus": "speed", "avoid_hills": true}
    ai_parameters = models.JSONField(default=dict, blank=True)

    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    @property
    def current_week_calculated(self):
        """
        Şu an kaçıncı haftadayız?
        Veritabanında tutmak yerine anlık hesaplıyoruz.
        """
        from django.utils import timezone
        today = timezone.now().date()
        
        if today < self.start_date:
            return 0 # Henüz başlamadı
        
        delta = today - self.start_date
        week_num = (delta.days // 7) + 1
        
        if week_num > self.duration_weeks:
            return self.duration_weeks # Plan bitti ama son haftada göster
            
        return week_num

    @property
    def progress_percent(self):
        """İlerleme çubuğu için yüzde hesabı"""
        if self.total_workouts_count == 0:
            return 0
        return int((self.completed_workouts_count / self.total_workouts_count) * 100)
    


# 3. WORKOUT MODEL
class Workout(models.Model):
    # Tipleri sadeleştirdim, LLM'in kafası karışmasın diye temel tiplere indirdim.
    class WorkoutType(models.TextChoices):
        TEMPO = 'tempo', _('Tempo Run')       # Hızlı
        EASY = 'easy', _('Easy Run')          # Yavaş / Rahat
        INTERVAL = 'interval', _('Intervals') # Aralıklı
        LONG = 'long', _('Long Run')          # Uzun
        REST = 'rest', _('Rest Day')          # Dinlenme

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', _('Scheduled')
        COMPLETED = 'completed', _('Completed')
        SKIPPED = 'skipped', _('Skipped')
        MISSED = 'missed', _('Missed')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(Program, on_delete=models.CASCADE, related_name='workouts')
    
    # --- LLM'DEN GELECEK TEMEL VERİLER ---
    # Başlık: "Hafif Koşu", "10K Test", "Pazar Uzunu" vb.
    title = models.CharField(max_length=255)
    
    # Türü: LLM buraya 'easy', 'long' vb. atayacak
    workout_type = models.CharField(max_length=20, choices=WorkoutType.choices)
    
    # Tarih: LLM 'YYYY-MM-DD' formatında verecek
    scheduled_date = models.DateField()
    
    # Mesafe (km)
    planned_distance = models.FloatField(default=0.0, help_text="km")
    
    # Süre (dk) - Bazı antrenmanlar süre bazlı olabilir (Örn: 45 dk koş)
    planned_duration = models.IntegerField(default=0, help_text="dakika")
    
    # Pace (Saniye) - LLM buraya hesaplanmış saniyeyi verecek (Örn: 330)
    target_pace_seconds = models.IntegerField(blank=True, null=True, help_text="Hedef saniye/km")

    # --- SİSTEM ALANLARI ---
    # Bu alanı LLM vermeyecek, biz save metodunda tarihten otomatik bulacağız.
    # Token tasarrufu sağlar.
    day_of_week = models.IntegerField(blank=True, null=True, help_text="0=Pazartesi... Otomatik hesaplanır")

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SCHEDULED)
    is_completed = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_date']

    def __str__(self):
        return f"{self.title} - {self.scheduled_date}"

    def save(self, *args, **kwargs):
        # LLM'e gün bilgisini yazdırmayacağız, tarihten biz bulacağız.
        # Bu sayede LLM token maliyeti düşer.
        if self.scheduled_date:
            self.day_of_week = self.scheduled_date.weekday() # 0=Mon, 6=Sun
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        """Frontend için string pace (5:30)"""
        if not self.target_pace_seconds:
            return "-"
        m = self.target_pace_seconds // 60
        s = self.target_pace_seconds % 60
        return f"{m}:{s:02d}"


# 4. WORKOUT RESULT
from django.utils import timezone

class WorkoutResult(models.Model):
    class Feeling(models.TextChoices):
        HARD = 'hard', _('Zor/Kötü')
        NORMAL = 'normal', _('Normal')
        EASY = 'easy', _('Kolay/İyi')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    # İLİŞKİLER
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='results')
    
    # Kritik Nokta: on_delete=models.SET_NULL
    # Senaryo: Kullanıcı "Programı güncelle" dedi, gelecek antrenmanlar silindi.
    # Ama bu antrenman "yapılmış" olduğu için logu kalmalı. 
    # Sadece 'workout' bağlantısı kopar, "Serbest Koşu"ya dönüşür.
    workout = models.OneToOneField(
        'Workout', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='result'
    )

    # --- GERÇEKLEŞEN PERFORMANS (Workout modelini aynalıyoruz) ---
    actual_distance = models.FloatField(help_text="Koşulan mesafe (km)")
    actual_duration = models.IntegerField(help_text="Koşulan süre (dakika)")
    
    # Pace'i sistem hesaplayacak (Saniye cinsinden)
    # Grafiklerde Workout.target_pace_seconds ile kıyaslanacak
    actual_pace_seconds = models.IntegerField(default=0, help_text="Ortalama pace (sn/km)")
    
    
    calories_burned = models.IntegerField(default=0, help_text="O anki kiloya göre hesaplanan kalori")

    # --- GERİ BİLDİRİM ---
    feeling = models.CharField(max_length=10, choices=Feeling.choices, default=Feeling.NORMAL)
    user_notes = models.TextField(blank=True, help_text="Kullanıcının kısa notları")

    # --- ZAMANLAMA ---
    # Kullanıcı geçmişe dönük veri girebilir, bu yüzden auto_now_add yerine default=now
    completed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-completed_at'] # En son yapılan en üstte

    def __str__(self):
        return f"{self.user.email} - {self.actual_distance}km ({self.completed_at.date()})"

    def save(self, *args, **kwargs):
        # Otomatik Pace Hesabı
        if self.actual_distance > 0 and self.actual_duration > 0:
            total_seconds = self.actual_duration * 60
            self.actual_pace_seconds = int(total_seconds / self.actual_distance)
        else:
            self.actual_pace_seconds = 0
            
        # 2. Otomatik Kalori Hesabı (Kalıcı Kayıt)
        if self.actual_distance > 0:
            # User'ın o anki kilosunu al
            current_weight = self.user.weight if self.user.weight else 70.0
            
            # Cinsiyete göre faktör
            burn_factor = 0.97 if self.user.gender == 'female' else 1.05
            
            # Formül: Mesafe * Kilo * Faktör
            self.calories_burned = int(self.actual_distance * current_weight * burn_factor)
        
        super().save(*args, **kwargs)

    @property
    def pace_display(self):
        """Frontend'de 06:00 formatında göstermek için"""
        if not self.actual_pace_seconds:
            return "-"
        m = self.actual_pace_seconds // 60
        s = self.actual_pace_seconds % 60
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