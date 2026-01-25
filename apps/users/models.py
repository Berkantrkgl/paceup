from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
import uuid
# Create your models here.

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
    profile_image = models.ImageField(upload_to='profile_images/', blank=True, null=True)
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