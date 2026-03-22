from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
import uuid
from django.utils import timezone
# Create your models here.

# 1. USER MODEL (Aynı kalıyor, sadece importları düzenledim)
class User(AbstractUser):
    class Gender(models.TextChoices):
        MALE = 'male', _('Male')
        FEMALE = 'female', _('Female')
        OTHER = 'other', _('Other')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_onboarded = models.BooleanField(default=False)

    # Personal info
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    profile_image = models.ImageField(upload_to='profile_images/', blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True)
    weight = models.FloatField(help_text="kg", blank=True, null=True)
    height = models.IntegerField(help_text="cm", blank=True, null=True)

    # Running info
    max_runned_distance = models.FloatField(default=0.0)
    current_pace = models.IntegerField(default=540, help_text="Saniye/km", blank=True, null=True)
    preferred_running_days = models.JSONField(default=list, blank=True, help_text="Örn: [0, 2, 4] (0=Pzt, 6=Paz)")

    # Current statistics
    total_workouts = models.IntegerField(default=0)
    total_distance = models.FloatField(default=0.0)
    total_time = models.IntegerField(default=0)
    current_streak = models.IntegerField(default=0)
    longest_streak = models.IntegerField(default=0)
    
    # Premium & SaaS
    total_tokens_used = models.IntegerField(default=0, help_text="Chatbot token kullanımı")
    is_premium = models.BooleanField(default=False)
    premium_type = models.CharField(
        max_length=10,
        choices=[('monthly', 'Aylık'), ('yearly', 'Yıllık')],
        blank=True, null=True
    )
    premium_expires_at = models.DateTimeField(blank=True, null=True)
    reschedules_used_this_month = models.IntegerField(default=0)
    last_reschedule_reset = models.DateField(auto_now_add=True, null=True, blank=True)

    # Notification fiels
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

    def check_premium_status(self):
        """Lazy check: Premium süresi dolmuşsa is_premium=False yapar."""
        if self.is_premium and self.premium_expires_at:
            if timezone.now() >= self.premium_expires_at:
                self.is_premium = False
                self.premium_type = None
                self.premium_expires_at = None
                self.save(update_fields=['is_premium', 'premium_type', 'premium_expires_at'])
                return False
        return self.is_premium

    def get_remaining_reschedules(self):
        """Kullanıcının kalan erteleme hakkını döner ve gerekiyorsa yeni ay sıfırlamasını yapar."""
        if self.is_premium:
            return 999  # Premium için sınırsız kabul edebiliriz (veya istersen onlara da limit koyabilirsin)
            
        today = timezone.now().date()
        # Eğer kayıtlı tarih yoksa veya ay/yıl değişmişse sıfırla
        if not self.last_reschedule_reset or (today.year > self.last_reschedule_reset.year or today.month > self.last_reschedule_reset.month):
            self.reschedules_used_this_month = 0
            self.last_reschedule_reset = today
            self.save(update_fields=['reschedules_used_this_month', 'last_reschedule_reset'])
            
        return max(0, 2 - self.reschedules_used_this_month)

    def use_reschedule(self):
        """Erteleme hakkı varsa kullanır ve True döner. Yoksa False döner."""
        if self.is_premium:
            return True
            
        if self.get_remaining_reschedules() > 0:
            self.reschedules_used_this_month += 1
            self.save(update_fields=['reschedules_used_this_month'])
            return True
            
        return False
    
    @property
    def pace_display(self):
        if not self.current_pace: return "0:00"
        m, s = divmod(self.current_pace, 60)
        return f"{m}:{s:02d}"