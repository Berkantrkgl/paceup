from rest_framework import serializers
from .models import User, Program, Workout, WorkoutResult, Achievement, Notification

# 1. USER SERIALIZER
class UserSerializer(serializers.ModelSerializer):
    # Modeldeki @property (Örn: "5:30") API'ye ekleniyor
    pace_display = serializers.ReadOnlyField()

    class Meta:
        model = User
        fields = [
            # 1. Temel Kimlik Bilgileri
            'id', 'email', 'username', 'password', 
            'first_name', 'last_name', 'phone', 
            'profile_image', 'date_of_birth', 'date_joined',

            # 2. Fiziksel Bilgiler
            'gender', 'weight', 'height',

            # 3. Koşu Bilgileri & Tercihler
            'experience_level', 'preferred_distance', 
            'current_max_distance', 
            'current_pace', 'pace_display',
            'weekly_goal',

            # 4. İstatistikler (Sadece Okunabilir)
            'total_workouts', 'total_distance', 
            'total_time', 'current_streak', 'longest_streak',

            # 5. Bildirim Teknik Detaylar
            'push_token', 'timezone', 'preferred_reminder_time',

            # 6. Bildirim Tercihleri
            'notification_workout_reminder', 'notification_weekly_report', 
            'notification_achievements', 'notification_plan_updates'
        ]

        extra_kwargs = {
            'password': {'write_only': True},
            'push_token': {'write_only': True},
            'username': {'read_only': True},
            'total_workouts': {'read_only': True},
            'total_distance': {'read_only': True},
            'total_time': {'read_only': True},
            'current_streak': {'read_only': True},
            'longest_streak': {'read_only': True},
        }

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if 'username' not in validated_data:
            email = validated_data.get('email')
            validated_data['username'] = email.split('@')[0]

        instance = self.Meta.model(**validated_data)
        if password is not None:
            instance.set_password(password)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


# 2. WORKOUT RESULT SERIALIZER (KRİTİK DÜZELTME BURADA)
class WorkoutResultSerializer(serializers.ModelSerializer):
    # Frontend'e "05:30" formatında pace döner
    pace_display = serializers.ReadOnlyField()

    class Meta:
        model = WorkoutResult
        fields = '__all__'
        
        # 'user' backend tarafından (request.user) atanacak, frontend göndermeyecek.
        # 'completed_at' frontend'den gelebilir (Geçmişe dönük veri için), o yüzden read_only değil.
        # 'calories_burned' ve 'actual_pace' model.save() metodunda hesaplanır.
        read_only_fields = ['user', 'actual_pace_seconds', 'calories_burned']


# 3. WORKOUT SERIALIZER
class WorkoutSerializer(serializers.ModelSerializer):
    result = WorkoutResultSerializer(read_only=True)
    # Hedef pace'i frontend'e "05:30" olarak döner
    pace_display = serializers.ReadOnlyField()
    
    # ⚠️ EKLEMEMİZ GEREKEN SATIR BU:
    # Bu sayede create işleminde sadece Program ID'si (örn: 15) göndererek ilişki kurabiliriz.
    program = serializers.PrimaryKeyRelatedField(queryset=Program.objects.all())

    class Meta:
        model = Workout
        fields = [
            'id', 'program', 'title', 'workout_type', 
            'scheduled_date', 'day_of_week',
            'planned_distance', 'planned_duration', 
            'target_pace_seconds', 'pace_display', 
            'status', 'is_completed', 
            'result', 
            'created_at'
        ]


# 4. PROGRAM SERIALIZER
class ProgramSerializer(serializers.ModelSerializer):
    # Backend'de hesaplanan kritik verileri API'ye ekliyoruz
    current_week_calculated = serializers.ReadOnlyField()
    progress_percent = serializers.ReadOnlyField()

    class Meta:
        model = Program
        fields = [
            'id', 'user', 'title', 'description', 'goal',
            'start_date', 'end_date', 'duration_weeks',
            'difficulty', 'workouts_per_week', 
            'total_workouts_count', 'completed_workouts_count',
            'status',
            'current_week_calculated', 
            'progress_percent',        
            'ai_generated', 'ai_parameters',
            'created_at'
        ]
        read_only_fields = ['user', 'completed_workouts_count', 'created_at']


# 5. ACHIEVEMENT SERIALIZER
class AchievementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Achievement
        fields = '__all__'


# 6. NOTIFICATION SERIALIZER
class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = '__all__'