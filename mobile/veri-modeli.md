
# VERİ MODELİ

### 1. USER (Kullanıcı)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- username (string, unique)
- email (string, unique)
- password (string, hashed)
- phone (string, optional)
- profile_image (string/URL, optional)
- date_of_birth (date, optional)

**Fiziksel Bilgiler:**
- gender (enum: male/female/other)
- weight (float, kg)
- height (integer, cm)

**Koşu Bilgileri:**
- experience_level (enum: beginner/intermediate/advanced)
- preferred_distance (enum: 5K/10K/half_marathon/marathon)
- current_max_distance (float, km)
- current_pace (string, örn: "5:30")
- weekly_goal (integer, 1-7)

**İstatistikler:**
- total_workouts (integer, default: 0)
- total_distance (float, default: 0.0)
- total_time (integer, dakika, default: 0)
- current_streak (integer, default: 0)
- longest_streak (integer, default: 0)

**Bildirim Tercihleri:**
- notification_workout_reminder (boolean, default: true)
- notification_weekly_report (boolean, default: true)
- notification_achievements (boolean, default: true)
- notification_plan_updates (boolean, default: true)

**Timestamp:**
- created_at (datetime)
- updated_at (datetime)

---

### 2. PROGRAM (Koşu Programı)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key -> User)
- title (string)
- description (text)
- goal (string, örn: "Maraton (42.2 km)")

**Tarih Bilgileri:**
- start_date (date)
- end_date (date)
- duration_weeks (integer)
- current_week (integer, default: 1)

**Program Parametreleri:**
- difficulty (enum: beginner/intermediate/advanced)
- workouts_per_week (integer, 1-7)
- total_workouts (integer)
- completed_workouts (integer, default: 0)

**Durum:**
- status (enum: active/completed/paused/cancelled, default: active)

**AI İlgili:**
- ai_generated (boolean, default: true)
- ai_conversation_history (JSON array)
- ai_parameters (JSON object)

**Timestamp:**
- created_at (datetime)
- updated_at (datetime)
- last_modified (datetime)

---

### 3. WORKOUT (Antrenman)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- program_id (UUID, Foreign Key -> Program)
- title (string)
- description (text)

**Tarih ve Zaman:**
- scheduled_date (date)
- scheduled_time (time, optional)
- week_number (integer)
- day_of_week (integer, 0-6, 0=Pazartesi)

**Antrenman Tipi:**
- workout_type (enum: tempo/easy/interval/long/rest/recovery)

**Planlanan Veriler:**
- planned_duration (integer, dakika)
- planned_distance (float, km, optional)
- target_pace (string, örn: "5:30", optional)

**Antrenman Detayları:**
- warmup (text, ısınma detayları)
- main_workout (text, ana antrenman detayları)
- cooldown (text, soğuma detayları)
- notes (text, ek notlar)

**Lokasyon ve Hava:**
- location (string, optional)
- weather_info (string, optional)

**Durum:**
- status (enum: scheduled/completed/skipped/rescheduled, default: scheduled)

**Timestamp:**
- created_at (datetime)
- updated_at (datetime)
- completed_at (datetime, optional)

---

### 4. WORKOUT_RESULT (Antrenman Sonucu)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- workout_id (UUID, Foreign Key -> Workout, One-to-One)

**Gerçekleşen Veriler:**
- actual_date (date)
- actual_start_time (time)
- actual_duration (integer, dakika)
- actual_distance (float, km)
- actual_pace (string, örn: "5:25")

**Sağlık Verileri:**
- avg_heart_rate (integer, bpm, optional)
- max_heart_rate (integer, bpm, optional)
- calories_burned (integer, optional)

**Kullanıcı Geri Bildirimi:**
- feeling (enum: excellent/good/okay/hard/very_hard, optional)
- difficulty_rating (integer, 1-5, optional)
- user_notes (text, optional)

**Teknik Veriler:**
- route_data (JSON, GPS koordinatları, optional)
- elevation_gain (float, metre, optional)

**Timestamp:**
- created_at (datetime)

---

### 5. ACHIEVEMENT (Başarım)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key -> User)
- title (string)
- description (text)
- achievement_type (enum: distance/workout_count/streak/pace/program_complete/special)

**Görsel:**
- icon_name (string, örn: "trophy")
- icon_color (string, hex color, örn: "#FFD93D")

**Timestamp:**
- earned_at (datetime)

---

### 6. NOTIFICATION (Bildirim)
**Temel Bilgiler:**
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key -> User)
- title (string)
- message (text)
- notification_type (enum: workout_reminder/weekly_report/achievement/plan_update/general)

**Durum:**
- is_read (boolean, default: false)

**İlişkiler (Optional):**
- related_workout_id (UUID, Foreign Key -> Workout, optional)
- related_program_id (UUID, Foreign Key -> Program, optional)

**Timestamp:**
- created_at (datetime)

---

## İLİŞKİLER

```
User (1) ----< (Many) Program
Program (1) ----< (Many) Workout
Workout (1) ---- (1) WorkoutResult
User (1) ----< (Many) Achievement
User (1) ----< (Many) Notification
```

**Cascade Kuralları:**
- User silinirse → Tüm Programs, Achievements, Notifications silinir
- Program silinirse → Tüm Workouts silinir
- Workout silinirse → WorkoutResult silinir
- Program/Workout silinirse → İlgili Notification'lar null yapılır (soft delete)

---

## INDEX'LER

**User:**
- email (unique)
- username (unique)

**Program:**
- user_id + status
- created_at

**Workout:**
- program_id + status
- scheduled_date
- program_id + scheduled_date

**WorkoutResult:**
- workout_id (unique)
- actual_date

**Achievement:**
- user_id + earned_at

**Notification:**
- user_id + is_read
- created_at

Bu yapı frontend'deki tüm özellikleri destekler! 🎯