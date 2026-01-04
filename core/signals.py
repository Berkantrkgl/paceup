from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import F
from django.utils import timezone
from datetime import timedelta
from .models import User, WorkoutResult, Achievement, Notification, Program, Workout

# -------------------------------------------------------------------------
# 1. SİNYAL: ANTRENMAN TAMAMLANINCA (Data Aggregation & Streak)
# -------------------------------------------------------------------------
@receiver(post_save, sender=WorkoutResult)
def handle_workout_completion(sender, instance, created, **kwargs):
    """
    Bir WorkoutResult kaydedildiğinde:
    1. User istatistiklerini güncelle (Toplam mesafe, süre ve SERİ).
    2. Eğer bu planlı bir antrenmansa, Program ve Workout durumunu güncelle.
    """
    if created:
        user = instance.user
        
        # --- A) STREAK (SERİ) HESAPLAMA MANTIĞI ---
        # Antrenmanın yapıldığı tarihi alıyoruz (Saat bilgisinden arındırılmış)
        current_workout_date = instance.completed_at.date()

        # Kullanıcının bu antrenmandan ÖNCEKİ en son antrenmanını buluyoruz.
        # completed_at alanına göre sıralayıp en sonuncuyu alıyoruz.
        last_workout = WorkoutResult.objects.filter(
            user=user,
            completed_at__lt=instance.completed_at # Şu ankinden tarihçe eski olanlar
        ).order_by('-completed_at').first()

        # Varsayılan olarak seri 1'dir (Eğer ilk antrenmansa)
        new_streak = 1

        if last_workout:
            last_workout_date = last_workout.completed_at.date()
            
            # Tarih farkını hesapla
            delta = current_workout_date - last_workout_date
            
            if delta.days == 1:
                # Son antrenman DÜN yapılmış -> Seri artar
                new_streak = user.current_streak + 1
            elif delta.days == 0:
                # Son antrenman BUGÜN yapılmış -> Aynı gün çift idman, seri değişmez
                new_streak = user.current_streak
            else:
                # Aradan 1 günden fazla geçmiş -> Zincir kırıldı, seri 1
                new_streak = 1
        
        # Hesaplanan yeni streak'i kullanıcı objesine ata
        user.current_streak = new_streak

        # En uzun seri rekorunu kontrol et
        if new_streak > user.longest_streak:
            user.longest_streak = new_streak

        # --- B) User İstatistiklerini Güncelle (Atomic Update) ---
        # F() expression kullanarak Race Condition'ı önlüyoruz.
        user.total_workouts = F('total_workouts') + 1
        user.total_distance = F('total_distance') + instance.actual_distance
        user.total_time = F('total_time') + instance.actual_duration
        
        # Tüm değişiklikleri (Hem streak hem F() değerleri) tek seferde kaydet
        user.save() 

        # --- C) Planlı Antrenman Yönetimi ---
        # Eğer bu koşu bir plana bağlıysa (Serbest koşu değilse)
        if instance.workout:
            workout = instance.workout
            
            # 1. Workout statüsünü güncelle
            workout.is_completed = True
            workout.status = Workout.Status.COMPLETED
            workout.save()

            # 2. Program ilerlemesini güncelle
            program = workout.program
            program.completed_workouts_count = F('completed_workouts_count') + 1
            program.save()


# -------------------------------------------------------------------------
# 2. SİNYAL: GAMIFICATION (Rozet Kontrolü)
# -------------------------------------------------------------------------
@receiver(post_save, sender=User)
def check_user_milestones(sender, instance, **kwargs):
    """
    User her güncellendiğinde (antrenman sonrası)
    yeni bir başarı kilidi açıldı mı diye bakar.
    """
    user = instance

    # F() expression kullandığımız için sayısal verilerin 
    # veritabanındaki son halini çekmemiz şart (Yoksa eski veriyi görürüz).
    try:
        user.refresh_from_db()
    except:
        return # User siliniyorsa hata vermesin

    # --- KURAL 1: İLK ADIM ---
    if user.total_workouts >= 1:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.WORKOUT_COUNT,
            title="İlk Adım",
            defaults={
                'description': "İlk antrenmanını tamamladın. Yolculuk başladı!",
                'icon_name': "footsteps", 
                'icon_color': "#4ECDC4"
            }
        )

    # --- KURAL 2: ALEV MODU (3 GÜNLÜK SERİ) ---
    # Models.py'de AchievementType.STREAK var, onu kullanıyoruz.
    if user.current_streak >= 3:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.STREAK,
            title="Alev Modu 🔥",
            defaults={
                'description': "3 gün üst üste antrenman yaptın. Durdurulamazsın!",
                'icon_name': "flame",
                'icon_color': "#FF4501" # Senin accent rengin
            }
        )
        
    # --- KURAL 3: 7 GÜNLÜK SERİ ---
    if user.current_streak >= 7:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.STREAK,
            title="Haftanın Yıldızı",
            defaults={
                'description': "Tam bir hafta boyunca aralıksız koştun.",
                'icon_name': "star",
                'icon_color': "#FFD93D"
            }
        )

    # --- KURAL 4: 10 KM KULÜBÜ ---
    if user.total_distance >= 10.0:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.DISTANCE,
            title="Şehir Gezgini",
            defaults={
                'description': "Toplamda 10 kilometreyi devirdin.",
                'icon_name': "map",
                'icon_color': "#FF6B6B"
            }
        )

    # --- KURAL 5: MARATON EŞDEĞERİ (42 KM) ---
    if user.total_distance >= 42.0:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type=Achievement.AchievementType.DISTANCE,
            title="Maratoncu Ruhu",
            defaults={
                'description': "Parça parça da olsa bir maraton mesafesi koştun!",
                'icon_name': "trophy",
                'icon_color': "#FFD93D"
            }
        )


# -------------------------------------------------------------------------
# 3. SİNYAL: BİLDİRİM SİSTEMİ (Achievement -> Notification)
# -------------------------------------------------------------------------
@receiver(post_save, sender=Achievement)
def create_achievement_notification(sender, instance, created, **kwargs):
    """
    Yeni bir Achievement yaratıldığında, 
    Kullanıcıya otomatik Notification düşür.
    """
    if created:
        Notification.objects.create(
            user=instance.user,
            title="Tebrikler! Yeni Rozet",
            message=f"'{instance.title}' rozetini kazandın. Profilinde görüntüle!",
            notification_type=Notification.NotificationType.ACHIEVEMENT,
            # Kullanıcı bildirime tıklarsa Achievement listesine gitmesi için bir logic eklenebilir.
        )