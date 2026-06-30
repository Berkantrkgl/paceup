from django.db import models
from django.utils.translation import gettext_lazy as _
import uuid
from django.conf import settings
from django.utils import timezone


# Create your models here.
# 2. PROGRAM MODEL (SADELEŞTİRİLDİ)
class Program(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'active', _('Active')       # Sadece bir tane olabilir
        INACTIVE = 'inactive', _('Inactive') # Arşivlenmiş/İptal edilmiş
        COMPLETED = 'completed', _('Completed')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='programs')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    goal = models.CharField(max_length=255)

    start_date = models.DateField()
    end_date = models.DateField()
    duration_weeks = models.IntegerField()

    running_days = models.JSONField(default=list, blank=True, help_text="Örn: [0, 2, 4]")
    
    total_workouts_count = models.IntegerField(default=0)
    completed_workouts_count = models.IntegerField(default=0)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)

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
    description = models.TextField(blank=True, default="")
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