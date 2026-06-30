from django.db import models
from django.utils import timezone
import uuid
from django.utils.translation import gettext_lazy as _
from django.conf import settings
# Create your models here.

# 4. WORKOUT RESULT (Değişiklik yok, sadece importlar için koydum)
class WorkoutResult(models.Model):
    class Feeling(models.TextChoices):
        HARD = 'hard', _('Zor')
        NORMAL = 'normal', _('Normal')
        EASY = 'easy', _('Kolay')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='results')
    workout = models.OneToOneField('programs.Workout', on_delete=models.SET_NULL, null=True, blank=True, related_name='result')

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