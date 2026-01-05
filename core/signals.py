from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import F
from django.utils import timezone
from datetime import timedelta
from .models import User, WorkoutResult, Achievement, Notification, Program, Workout

# -------------------------------------------------------------------------
# 1. SİNYAL: ANTRENMAN TAMAMLANINCA (Data Aggregation & Program Streak)
# -------------------------------------------------------------------------
@receiver(post_save, sender=WorkoutResult)
def handle_workout_completion(sender, instance, created, **kwargs):
    if created:
        user = instance.user
        
        # --- A) YENİ STREAK MANTIĞI: PROGRAM SADAKATİ ---
        # Mantık: Aktif programdaki geçmiş antrenmanlara bak. 
        # Sondan başa doğru "Tamamlanmış" olanları say. İlk firede dur.
        
        new_streak = 0
        
        # 1. Eğer bu sonuç bir plana bağlıysa planın geçmişine bak
        if instance.workout:
            current_program = instance.workout.program
            
            # Bu programdaki, bugüne kadar olan (bugün dahil) tüm antrenmanları 
            # tarihe göre tersten (yeniden eskiye) çek.
            past_workouts = Workout.objects.filter(
                program=current_program,
                scheduled_date__lte=instance.workout.scheduled_date
            ).order_by('-scheduled_date')

            # Zinciri kontrol et
            for w in past_workouts:
                if w.is_completed:
                    new_streak += 1
                else:
                    # Zincir koptu (Yapılmamış/Atlanmış antrenman)
                    break
        
        # 2. Eğer programsız (Serbest) koşuysa
        else:
            # Serbest koşular mevcut seriyi bozmaz ama artırır mı?
            # Senin kuralına göre "Program antrenmanları" bazlı olduğu için
            # serbest koşuyu seriye dahil etmiyor veya mevcut seriyi koruyoruz.
            # Şimdilik mevcut seriyi koruyalım ama artırmayalım.
            new_streak = user.current_streak 
            # İstersen: new_streak += 1 yapabilirsin.

        # Yeni seriyi kaydet
        user.current_streak = new_streak

        # Rekor Kontrolü
        if user.current_streak > user.longest_streak:
            user.longest_streak = user.current_streak

        # --- B) İstatistikleri Güncelle ---
        user.total_workouts = F('total_workouts') + 1
        user.total_distance = F('total_distance') + instance.actual_distance
        user.total_time = F('total_time') + instance.actual_duration
        
        user.save() 

        # --- C) Planlı Antrenman Yönetimi ---
        if instance.workout:
            workout = instance.workout
            workout.is_completed = True
            workout.status = Workout.Status.COMPLETED
            workout.save()

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
        
        
# -------------------------------------------------------------------------
# 4. SİNYAL: ANTRENMAN İPTAL EDİLİNCE / SİLİNİNCE (Undo Logic)
# -------------------------------------------------------------------------
@receiver(post_delete, sender=WorkoutResult)
def handle_workout_deletion(sender, instance, **kwargs):
    """
    Bir WorkoutResult silindiğinde (Kullanıcı 'Tamamlanmadı'ya bastığında):
    Kullanıcı istatistiklerini geri al (Azalt).
    """
    user = instance.user
    
    # İstatistikleri düşür
    if user.total_workouts > 0:
        user.total_workouts = F('total_workouts') - 1
        
    if user.total_distance >= instance.actual_distance:
        user.total_distance = F('total_distance') - instance.actual_distance
        
    if user.total_time >= instance.actual_duration:
        user.total_time = F('total_time') - instance.actual_duration

    # Streak'i yeniden hesaplamak karmaşık olduğu için (aradaki zinciri bulmak gerekir)
    # şimdilik basitçe: Eğer bu antrenman son seri günüyse seriyi 1 azalt diyebiliriz
    # ama veri tutarlılığı için streak'e dokunmamak veya sıfırlamamak daha güvenli olabilir.
    # Şimdilik temel istatistikleri düzeltiyoruz.
    
    user.save()

    # Eğer bu sonuç bir plana bağlıysa, planın sayacını da düşür
    if instance.workout:
        workout = instance.workout
        
        # Workout statüsünü otomatiğe bağlamak yerine frontend'den yönetmek daha güvenli
        # ama garanti olsun diye burada da statüyü 'scheduled' yapabiliriz.
        workout.is_completed = False
        workout.status = Workout.Status.SCHEDULED
        workout.save()

        program = workout.program
        if program.completed_workouts_count > 0:
            program.completed_workouts_count = F('completed_workouts_count') - 1
            program.save()