# apps/gamification/signals.py

from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.users.models import User
from .models import Achievement

@receiver(post_save, sender=User)
def check_user_milestones(sender, instance, **kwargs):
    user = instance
    # save() methodu içinde sonsuz döngüye girmemek için bu kontrol önemlidir
    # Ancak User modeli User app'inde save edilirken burası çalışır.
    # achievement create ederken user'ı save etmiyoruz, o yüzden döngü riski azdır.
    
    # Not: Django sinyallerinde instance.refresh_from_db() bazen race condition yaratabilir
    # ama mevcut mantığını koruyorum:
    
    if user.total_workouts >= 1:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type='workout_count', # Enum yerine string veya import kullan
            title="İlk Adım",
            defaults={'description': "İlk antrenmanını tamamladın!", 'icon_name': "footsteps", 'icon_color': "#4ECDC4"}
        )

    if user.current_streak >= 3:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type='streak',
            title="Alev Modu 🔥",
            defaults={'description': "3 gün üst üste programına uydun!", 'icon_name': "flame", 'icon_color': "#FF4501"}
        )
        
    if user.current_streak >= 7:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type='streak',
            title="Haftanın Yıldızı",
            defaults={'description': "Programını 1 hafta boyunca aksatmadın.", 'icon_name': "star", 'icon_color': "#FFD93D"}
        )

    if user.total_distance >= 10.0:
        Achievement.objects.get_or_create(
            user=user,
            achievement_type='distance',
            title="Şehir Gezgini",
            defaults={'description': "Toplamda 10 km koştun.", 'icon_name': "map", 'icon_color': "#FF6B6B"}
        )