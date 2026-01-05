from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from django.utils import timezone
from .models import User, WorkoutResult, Achievement, Notification, Program, Workout

# --- YARDIMCI FONKSİYON: SERİ HESAPLAMA (ZİNCİR MANTIĞI) ---
def calculate_program_streak(user):
    """
    Programdaki antrenmanları bugünden geriye doğru tarar.
    Arada yapılmamış (Completed=False) bir geçmiş gün görürse durur.
    """
    # 1. Aktif veya son programı bul
    active_program = Program.objects.filter(user=user, status='active').first()
    if not active_program:
        active_program = Program.objects.filter(user=user).order_by('-created_at').first()
    
    if not active_program:
        return 0

    today = timezone.now().date()

    # 2. Bugüne kadar olan (gelecek hariç) tüm antrenmanları TERSTEN çek
    # Önemli: En yeni tarih en başta olmalı.
    past_workouts = Workout.objects.filter(
        program=active_program,
        scheduled_date__lte=today
    ).order_by('-scheduled_date', '-id') # Aynı gün çift idman varsa id sırasına da bak

    streak = 0
    
    for w in past_workouts:
        # A) Antrenman Tamamlandıysa -> Zincire ekle
        if w.is_completed:
            streak += 1
            
        # B) Tamamlanmadıysa Kontrol Et
        else:
            # Eğer bu yapılmamış antrenman BUGÜN ise:
            # Zinciri bozma (belki akşam yapacak), ama sayıya da ekleme.
            # Bir öncekine (düne) bakmak için devam et.
            if w.scheduled_date == today:
                continue
            
            # Eğer bu yapılmamış antrenman GEÇMİŞTE ise:
            # ZİNCİR KOPTU. Daha geriye gitmeye gerek yok.
            else:
                break
            
    return streak


# -------------------------------------------------------------------------
# 1. SİNYAL: ANTRENMAN TAMAMLANINCA (Ekleme)
# -------------------------------------------------------------------------
@receiver(post_save, sender=WorkoutResult)
def handle_workout_completion(sender, instance, created, **kwargs):
    if created:
        user = instance.user
        
        # A) Önce Statüleri Güncelle
        if instance.workout:
            workout = instance.workout
            workout.is_completed = True
            workout.status = Workout.Status.COMPLETED
            workout.save()

            program = workout.program
            program.completed_workouts_count = F('completed_workouts_count') + 1
            program.save()

        # B) Streak Hesapla (Yeni Mantık)
        new_streak = calculate_program_streak(user)
        user.current_streak = new_streak

        # Max Streak Kontrolü (Her zaman kontrol ediyoruz)
        if user.current_streak > user.longest_streak:
            user.longest_streak = user.current_streak

        # C) İstatistikleri Güncelle
        user.total_workouts = F('total_workouts') + 1
        user.total_distance = F('total_distance') + instance.actual_distance
        user.total_time = F('total_time') + instance.actual_duration
        
        user.save()


# -------------------------------------------------------------------------
# 2. SİNYAL: ANTRENMAN SİLİNİNCE (Geri Alma)
# -------------------------------------------------------------------------
@receiver(post_delete, sender=WorkoutResult)
def handle_workout_deletion(sender, instance, **kwargs):
    user = instance.user
    
    # A) İstatistikleri Düşür
    if user.total_workouts > 0:
        user.total_workouts = F('total_workouts') - 1
        
    if user.total_distance >= instance.actual_distance:
        user.total_distance = F('total_distance') - instance.actual_distance
        
    if user.total_time >= instance.actual_duration:
        user.total_time = F('total_time') - instance.actual_duration

    user.save()
    user.refresh_from_db()

    # B) Statüleri Geri Al
    if instance.workout:
        workout = instance.workout
        workout.is_completed = False
        workout.status = Workout.Status.SCHEDULED
        workout.save()

        program = workout.program
        if program.completed_workouts_count > 0:
            program.completed_workouts_count = F('completed_workouts_count') - 1
            program.save()

    # C) Streak'i Yeniden Hesapla
    # Silinen antrenman artık "yapılmamış" olduğu için
    # calculate_program_streak fonksiyonu zincirin koptuğu yeri doğru bulacaktır.
    new_streak = calculate_program_streak(user)
    user.current_streak = new_streak
    
    # Not: Silme işleminde longest_streak düşmez, rekor rekordur.
    
    user.save()


# -------------------------------------------------------------------------
# 3. SİNYAL: GAMIFICATION (Rozetler)
# -------------------------------------------------------------------------
@receiver(post_save, sender=User)
def check_user_milestones(sender, instance, **kwargs):
    user = instance
    try:
        user.refresh_from_db()
    except:
        return 

    if user.total_workouts >= 1:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.WORKOUT_COUNT,
            title="İlk Adım",
            defaults={'description': "İlk antrenmanını tamamladın!", 'icon_name': "footsteps", 'icon_color': "#4ECDC4"}
        )

    if user.current_streak >= 3:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.STREAK,
            title="Alev Modu 🔥",
            defaults={'description': "3 gün üst üste programına uydun!", 'icon_name': "flame", 'icon_color': "#FF4501"}
        )
        
    if user.current_streak >= 7:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.STREAK,
            title="Haftanın Yıldızı",
            defaults={'description': "Programını 1 hafta boyunca aksatmadın.", 'icon_name': "star", 'icon_color': "#FFD93D"}
        )

    if user.total_distance >= 10.0:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.DISTANCE,
            title="Şehir Gezgini",
            defaults={'description': "Toplamda 10 km koştun.", 'icon_name': "map", 'icon_color': "#FF6B6B"}
        )


# -------------------------------------------------------------------------
# 4. SİNYAL: BİLDİRİM
# -------------------------------------------------------------------------
@receiver(post_save, sender=Achievement)
def create_achievement_notification(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            user=instance.user,
            title="Tebrikler! Yeni Rozet",
            message=f"'{instance.title}' rozetini kazandın!",
            notification_type=Notification.NotificationType.ACHIEVEMENT,
        )