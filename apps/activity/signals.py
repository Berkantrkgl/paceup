# apps/activity/signals.py

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from django.utils import timezone

# Kendi modelimiz
from .models import WorkoutResult

# Diğer app'lerden modelleri çekiyoruz
from apps.users.models import User
from apps.programs.models import Program, Workout

# --- YARDIMCI FONKSİYON: SERİ HESAPLAMA ---
def calculate_program_streak(user):
    # (Kodun aynısı, mantık değişmedi)
    active_program = Program.objects.filter(user=user, status='active').first()
    if not active_program:
        active_program = Program.objects.filter(user=user).order_by('-created_at').first()
    
    if not active_program:
        return 0

    today = timezone.now().date()

    past_workouts = Workout.objects.filter(
        program=active_program,
        scheduled_date__lte=today
    ).order_by('-scheduled_date', '-id')

    streak = 0
    for w in past_workouts:
        if w.is_completed:
            streak += 1
        else:
            if w.scheduled_date == today:
                continue
            else:
                break
    return streak

# --- SİNYALLER ---

@receiver(post_save, sender=WorkoutResult)
def handle_workout_completion(sender, instance, created, **kwargs):
    if created:
        user = instance.user
        
        # A) Statüleri Güncelle
        if instance.workout:
            workout = instance.workout
            workout.is_completed = True
            workout.status = 'completed' # Enum import etmek yerine string kullanabilirsin veya import edebilirsin
            workout.save()

            program = workout.program
            program.completed_workouts_count = F('completed_workouts_count') + 1
            program.save()

        # B) Streak Hesapla
        new_streak = calculate_program_streak(user)
        user.current_streak = new_streak

        if user.current_streak > user.longest_streak:
            user.longest_streak = user.current_streak

        # C) İstatistikleri Güncelle
        user.total_workouts = F('total_workouts') + 1
        user.total_distance = F('total_distance') + instance.actual_distance
        user.total_time = F('total_time') + instance.actual_duration
        
        user.save()

@receiver(post_delete, sender=WorkoutResult)
def handle_workout_deletion(sender, instance, **kwargs):
    # (Kodun aynısı)
    user = instance.user
    
    if user.total_workouts > 0:
        user.total_workouts = F('total_workouts') - 1
        
    if user.total_distance >= instance.actual_distance:
        user.total_distance = F('total_distance') - instance.actual_distance
        
    if user.total_time >= instance.actual_duration:
        user.total_time = F('total_time') - instance.actual_duration

    user.save()
    user.refresh_from_db()

    if instance.workout:
        workout = instance.workout
        workout.is_completed = False
        workout.status = 'scheduled'
        workout.save()

        program = workout.program
        if program.completed_workouts_count > 0:
            program.completed_workouts_count = F('completed_workouts_count') - 1
            program.save()

    new_streak = calculate_program_streak(user)
    user.current_streak = new_streak
    user.save()