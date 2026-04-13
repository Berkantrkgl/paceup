# 🛠️ PaceUp Backend Technical Architecture Documentation v3.0

Bu belge, **Django REST Framework (DRF)** üzerine kurulu, **Domain Driven Design (DDD)** prensiplerine göre modüler PaceUp backend mimarisini tanımlar.

---

## 0. Project Structure

```
PACEUP-BACKEND/
├── manage.py
├── requirements.txt        # Tüm bağımlılıklar
├── paceupbackend/          # Main Settings & URL Routing
└── apps/
    ├── users/              # Auth, User Model, Token & Kota Yönetimi
    ├── programs/           # Program & Workout Modelleri
    ├── activity/           # WorkoutResult & Signals (Business Logic)
    ├── gamification/       # Achievement & Ödül Mantığı
    ├── notifications/      # Notification Modeli + Push + Tasks
    │   ├── push.py                          # Expo push util
    │   ├── tasks.py                         # django-q2 scheduled tasks
    │   └── management/commands/
    │       └── setup_periodic_tasks.py      # Cron kayıt komutu
    └── analytics/          # Sadece View Katmanı (Dashboard)
```

---

## 1. Domain Models

### A. `users` — User Model (AbstractUser)

| Alan Grubu    | Alanlar                                                                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity      | `id` (UUID), `email` (login), `username` (auto-generated), `is_onboarded`, `profile_image`, `phone`, `date_of_birth`                                                                       |
| Tour          | `tour_home`, `tour_calendar`, `tour_plans`, `tour_profile` — her tab için ayrı bool, default False                                                                                         |
| Physical      | `weight` (kg), `height` (cm), `gender` (male/female/other), `max_runned_distance`, `current_pace` (sn/km, nullable)                                                                        |
| Preferences   | `preferred_running_days` (JSON: `[0,2,4]` → 0=Pzt, 6=Paz)                                                                                                                                  |
| SaaS          | `is_premium`, `premium_type` (monthly/yearly, nullable), `premium_expires_at` (DateTime, nullable), `total_tokens_used`, `reschedules_used_this_month`, `last_reschedule_reset`            |
| Stats         | `total_distance`, `total_workouts`, `total_time`, `current_streak`, `longest_streak`                                                                                                       |
| Notifications | `push_token`, `timezone` (default UTC), `preferred_reminder_time`, `notification_workout_reminder`, `notification_weekly_report`, `notification_achievements`, `notification_plan_updates` |
| Dynamic       | `active_program_id` — DB'de tutulmaz, Serializer'da anlık hesaplanır                                                                                                                       |
| Computed      | `remaining_tokens`, `can_use_chat`, `remaining_reschedules`, `pace_display` — Serializer'da hesaplanır                                                                                     |

**Model Metodları:**

- `check_premium_status()` — Lazy check: `premium_expires_at` geçmişse `is_premium=False`, `premium_type=None`, `premium_expires_at=None` yapar
- `get_remaining_reschedules()` — Lazy Reset ile aylık hakkı döner
- `use_reschedule()` — Hak varsa kullanır, yoksa False döner
- `pace_display` (property) — `current_pace` saniyeyi `"5:30"` formatına çevirir

### B. `programs`

| Model   | Kritik Alanlar                                                                                                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Program | `title`, `description`, `goal`, `start_date`, `end_date`, `duration_weeks`, `running_days` (JSON), `status` (ACTIVE/INACTIVE/COMPLETED), `total_workouts_count`, `completed_workouts_count`                                                                        |
| Workout | `program` (FK), `title`, `description` (TextField, blank), `workout_type` (easy/tempo/interval/long), `scheduled_date`, `day_of_week` (auto), `planned_distance`, `planned_duration`, `target_pace_seconds`, `status` (SCHEDULED/COMPLETED/MISSED), `is_completed` |

**Kurallar:**

- Kullanıcı başına aynı anda yalnızca 1 ACTIVE program olabilir
- `Workout.save()` otomatik olarak `day_of_week`'i `scheduled_date.weekday()`'den hesaplar
- `Program.current_week_calculated` (property): Bugünün tarihine göre kaçıncı haftada olduğunu hesaplar
- `Program.progress_percent` (property): `(completed / total) * 100`

### C. `activity`

| Model         | Kritik Alanlar                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkoutResult | `user` (FK), `workout` (OneToOne, opsiyonel), `actual_distance`, `actual_duration`, `actual_pace`, `calories_burned`, `feeling`, `completed_at` |

### D. `gamification` & `notifications`

- `Achievement`: `achievement_type`, `icon_name`, `icon_color`
- `Notification`: `notification_type`, `related_workout`, `related_program`

---

## 2. Authentication & Authorization

**JWT Authentication** (`rest_framework_simplejwt`):

- `AUTH_USER_MODEL = 'users.User'` — Custom User, email ile login
- `USERNAME_FIELD = 'email'`, `REQUIRED_FIELDS = ['username']`
- `username` otomatik üretilir (`email.split('@')[0]`, çakışma varsa UUID suffix eklenir)

**Token Akışı:**

| Endpoint                   | Açıklama                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `POST /api/token/`         | Email + password → `{ access, refresh }` JWT token çifti döner |
| `POST /api/token/refresh/` | Refresh token → yeni access token döner                        |

**Register Akışı:**

- `POST /api/users/` (AllowAny) → User oluşturur + otomatik JWT token çifti döner (`access` + `refresh`)
- Diğer tüm endpoint'ler `IsAuthenticated` gerektirir
- Header: `Authorization: Bearer <access_token>`

**Google Sign-In** (`POST /api/auth/google/`):

İki flow desteklenir (backward compatible):

1. **Authorization Code Flow (önerilen):** `{ "code": "...", "redirect_uri": "..." }` → Backend Google'a token exchange yapar → id_token doğrular → JWT döner
2. **id_token Flow (eski):** `{ "id_token": "..." }` → Direkt doğrular → JWT döner

- Google `id_token`'dan `email`, `given_name`, `family_name` çıkarılır
- Email ile kullanıcı varsa → mevcut kullanıcı bulunur
- Yoksa → yeni kullanıcı oluşturulur (`set_unusable_password`, username otomatik)
- Response: `{ "access": "...", "refresh": "...", "created": true/false }`
- Paket: `google-auth` (`google.oauth2.id_token`, `google.auth.transport.requests`)
- Credentials `.env`'den okunur: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

**Onboarding Akışı:**

- Register veya Google Sign-In ile oluşturulan kullanıcılar `is_onboarded: false` ile başlar
- Frontend onboarding ekranlarında boy, kilo, cinsiyet, doğum tarihi, pace, koşu günleri toplanır
- Tüm veriler tek bir `PATCH /api/users/me/` isteğiyle gönderilir (`is_onboarded: true` dahil)
- Frontend `is_onboarded` değerine bakarak kullanıcıyı onboarding'e mi ana ekrana mı yönlendireceğine karar verir

**Tab Tour Sistemi:**

- Her tab için ayrı boolean: `tour_home`, `tour_calendar`, `tour_plans`, `tour_profile`
- Kullanıcı bir tab'ın tour'unu tamamladığında `PATCH /api/users/me/` → `{ "tour_home": true }`
- Frontend `tour_*` değerine bakarak o tab'da tour gösterilip gösterilmeyeceğine karar verir
- Telefon değişse / uygulama silinse bile tour durumu korunur (backend'de persist)

**REST Framework Config:**

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}
```

---

## 3. API Endpoints

### Auth & Users (`/api/users/`)

| Endpoint                              | Açıklama                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/token/`                    | Login → `{ access, refresh }` JWT döner                                                                      |
| `POST /api/token/refresh/`            | Refresh token → yeni access token                                                                            |
| `POST /api/auth/google/`             | Google Sign-In: code flow veya id_token flow → `{ access, refresh, created }` döner                          |
| `POST /api/users/`                    | Register (AllowAny) → user + JWT token döner                                                                 |
| `GET/PATCH /api/users/me/`            | Profil + computed alanlar (`remaining_reschedules`, `active_program_id`, `remaining_tokens`, `can_use_chat`) |
| `POST /api/users/update_token_usage/` | Chat sonrası token sayacını günceller, `can_use_chat` döner                                                  |
| `POST /api/users/activate_premium/`   | Premium aktifle: `{ premium_type: "monthly" \| "yearly" }` alır, expire tarihi hesaplar                      |
| `POST /api/users/cancel_premium/`     | Premium iptal: `is_premium=False`, `premium_type=null`, `premium_expires_at=null` yapar                      |
| `POST /api/users/register_push_token/` | Expo push token'ı kullanıcıya bağlar. Body: `{ push_token: "ExponentPushToken[...]" }`. Format doğrulaması yapılır, cihaz değişikliğinde günceller |

### Programs & Workouts

| Endpoint                               | Açıklama                                                      |
| -------------------------------------- | ------------------------------------------------------------- |
| `GET/POST /api/programs/`              | Kullanıcının programlarını listele / yeni program oluştur     |
| `GET/PATCH/DELETE /api/programs/{id}/` | Program detay / güncelle / sil                                |
| `POST /api/programs/create_ai_plan/`   | Eski aktif planı pasife çeker, yeni AI planı oluşturur        |
| `POST /api/programs/{id}/activate/`    | Arşivden plan aktifleştirir                                   |
| `POST /api/programs/{id}/reschedule/`  | Kota kontrollü akıllı erteleme                                |
| `GET /api/workouts/?only_active=true`  | Takvim için filtreli veri, geçmiş yapılmamışları MISSED yapar |
| `GET/PATCH /api/workouts/{id}/`        | Workout detay / güncelle                                      |
| `GET/POST /api/results/`               | Antrenman sonuçlarını listele / yeni sonuç kaydet             |
| `GET/PATCH/DELETE /api/results/{id}/`  | Sonuç detay / güncelle / sil                                  |
| `GET /api/achievements/`               | Kullanıcının rozetlerini listele                              |
| `GET/PATCH /api/notifications/`        | Bildirimleri listele / okundu işaretle                        |

### Analytics

| Endpoint                  | Açıklama                             |
| ------------------------- | ------------------------------------ |
| `GET /api/stats/summary/` | Hero kartları, streak, haftalık özet |
| `GET /api/stats/charts/`  | Grafik verisi (`?period=week/month`) |
| `GET /api/stats/program/` | Aktif program özeti + Next Workout   |

### `create_ai_plan` Payload Formatı

```json
{
  "title": "5K Hızlandırma",
  "description": "Opsiyonel program açıklaması",
  "start_date": "2026-03-23",
  "duration_weeks": 6,
  "running_days": [0, 2, 4],
  "goal": "5K",
  "workouts": [
    {
      "title": "Kolay Koşu",
      "description": "Isınma temposuyla rahat bir koşu",
      "workout_type": "easy",
      "day_offset": 0,
      "distance_km": 3.0,
      "duration_minutes": 24,
      "target_pace_seconds": 480
    }
  ]
}
```

- `day_offset`: `start_date`'den itibaren gün farkı (0 = ilk gün)
- `running_days`: Backend'de program'a kaydedilir, reschedule'da kullanılır
- Workout `description`: AI tarafından üretilen antrenman açıklaması (ısınma, tempo hedefi vb.)

---

## 4. Serializer — `UserSerializer`

`SerializerMethodField` ile hesaplanan alanlar:

```python
TOKEN_LIMIT_FREE = 50000  # serializers.py'de tanımlı, views.py import eder

# to_representation() override → her serialize'da check_premium_status() çağrılır (lazy expiry)

get_remaining_reschedules → obj.get_remaining_reschedules()
get_active_program_id     → obj.programs.filter(status='active').first()
get_remaining_tokens      → None (premium) | max(0, 50000 - total_tokens_used)
get_can_use_chat          → True (premium) | total_tokens_used < 50000
```

**Read-only alanlar:** `is_premium`, `premium_type`, `premium_expires_at` — sadece `activate_premium` / `cancel_premium` endpoint'leri üzerinden değiştirilebilir.

---

## 5. Token & Premium Sistemi

**Premium Abonelik Mantığı:**

- `premium_type`: `monthly` (30 gün) veya `yearly` (365 gün)
- `premium_expires_at`: Abonelik bitiş tarihi (DateTime)
- **Lazy check:** `UserSerializer.to_representation()` her serialize'da `check_premium_status()` çağırır — expire olmuşsa otomatik düşürür, cron job gereksiz
- `activate_premium`: `{ premium_type: "monthly" | "yearly" }` alır, `premium_expires_at = now + duration` hesaplar
- `cancel_premium`: Tüm premium alanlarını temizler (`is_premium=False`, `premium_type=null`, `premium_expires_at=null`)

**Token Kullanım Mantığı:**

- `total_tokens_used` her chat stream'inden sonra birikimli artar
- Sıfırlama yok — üyelik başından itibaren toplam 50.000 token hakkı
- `is_premium=True` olunca `total_tokens_used` güncellenmez, tüm kontroller bypass edilir

**`update_token_usage` Akışı:**

1. Frontend stream bitince `POST /users/update_token_usage/` → `{ tokens_used: N }`
2. Premium değilse `total_tokens_used += N` güncellenir
3. Response: `{ remaining_tokens, can_use_chat }`

---

## 6. Event-Driven Architecture (Signals)

| Signal                  | Tetikleyici               | Aksiyon                                                                                                 |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- |
| `activity.signals`      | WorkoutResult save/delete | Workout → COMPLETED, program ilerlemesi güncellenir, user stats güncellenir, streak sıfırdan hesaplanır |
| `gamification.signals`  | User update               | Eşik kontrolü, Achievement oluşturulur                                                                  |
| `notifications.signals` | Achievement create        | In-app Notification oluşturulur **+** push notification gönderilir (`send_push_notification`)           |

**Signal Zinciri:** `WorkoutResult.save()` → activity signal (user stats güncelle + `user.save()`) → gamification signal (achievement kontrol) → notifications signal (Notification oluştur + push gönder)

**WorkoutResult Auto-Calculations (save override):**

- `actual_pace_seconds = (actual_duration * 60) / actual_distance`
- `calories_burned = actual_distance * weight * burn_factor` (female: 0.97, male: 1.05)

**Achievement Eşikleri:**

- `total_workouts >= 1` → "İlk Adım" (footsteps, #4ECDC4)
- `current_streak >= 3` → "Alev Modu 🔥" (flame, #FF4501)
- `current_streak >= 7` → "Haftanın Yıldızı" (star, #FFD93D)
- `total_distance >= 10` → "Şehir Gezgini" (map, #FF6B6B)

---

## 7. Push Notification & Task Queue

Mobil push notification'lar **Expo Push API** üzerinden gönderilir. Backend Apple APNs / Google FCM'e direkt bağlanmaz — Expo sunucusu aradadır. Sayede APNs key, token yönetimi, platform farklılıkları Expo tarafında abstract edilir.

### Mimari

```
┌─────────────────┐       ┌──────────────────┐       ┌────────────┐
│  Django Backend │──────▶│  Expo Push API   │──────▶│ Apple APNs │──▶ 📱
│ send_push_...() │       │ (exp.host/.../send) │    │ Google FCM │
└─────────────────┘       └──────────────────┘       └────────────┘
        ▲
        │ tetikleyiciler:
        │ • Achievement signal (anlık)
        │ • Django-Q2 cron task (her saat başı)
```

### Bağımlılıklar

| Paket | Görev |
|-------|-------|
| `django-q2` | Task queue + cron scheduler. ORM broker (PostgreSQL/SQLite) kullanır — Redis gerektirmez |
| `exponent-server-sdk` | `PushClient().publish(PushMessage(...))` ile Expo Push API istemcisi |
| `croniter` | Django-Q2 CRON schedule parse'ı için gerekli |

### Django-Q2 Konfigürasyonu

```python
# settings.py
INSTALLED_APPS += ['django_q']

Q_CLUSTER = {
    'name': 'paceup',
    'workers': 2,
    'recycle': 500,
    'timeout': 60,
    'retry': 120,
    'orm': 'default',   # ORM broker — Redis yok
    ...
}
```

- **Worker:** `python manage.py qcluster` komutu 7/24 çalışır
- **Production:** Aynı Django ECS task'ı içinde Supervisor ile 2 process (`gunicorn` + `qcluster`). Ekstra infra/maliyet yok
- **Schedule tablosu:** DB'de tutulur — `setup_periodic_tasks` management command ile idempotent yönetilir

### `apps/notifications/push.py` — Core Util

```python
send_push_notification(user, title, body, data=None, notification_type=None)
```

**Davranış:**
- `user.push_token` yoksa → atla, `False` döner
- `notification_type` verilmişse (`workout_reminder` / `achievement` / `weekly_report` / `plan_update`) → user'ın ilgili toggle alanı (`notification_*`) kapalıysa atla
- Expo Push API'ye istek atar, `PushMessage` ile gönderir (title, body, data, `sound="default"`, `priority="high"`)
- **Stale token temizleme:** `DeviceNotRegisteredError` dönerse `user.push_token = None` yapılır (kullanıcı app'i silmiş olabilir)
- **Hata dayanıklılığı:** `PushServerError`, `ConnectionError`, `HTTPError` → log'lanır, `False` döner, çağıran kod çökmez

**Preference eşleme:**

```python
NOTIFICATION_PREFERENCE_MAP = {
    "workout_reminder": "notification_workout_reminder",
    "weekly_report":    "notification_weekly_report",
    "achievement":      "notification_achievements",
    "plan_update":      "notification_plan_updates",
}
```

### Scheduled Task — `send_workout_reminders`

`apps/notifications/tasks.py` içinde. Her saat başı çalışır, ertesi gün antrenmanı olan kullanıcılara hatırlatma gönderir.

**Cron:** `0 * * * *` (her saat xx:00'da)

**Algoritma:**

```python
1. User.objects.filter(
       notification_workout_reminder=True,
       push_token__isnull=False,
   ).exclude(push_token="")

2. Her user için:
   a. user'ın kendi timezone'undaki şu anki datetime → local_now
   b. local_now.hour != user.preferred_reminder_time.hour → skip
   c. tomorrow = (local_now + 1 gün).date()
   d. Workout.objects.filter(
          program__user=user,
          program__status='active',
          scheduled_date=tomorrow,
          status='scheduled',
      ).first() → workout
   e. workout yoksa → skip
   f. send_push_notification(
          user,
          title="Yarın antrenmanın var! 🏃",
          body=f"{workout.title} • {km} km • {min} dk",
          data={"type": "workout_reminder", "workout_id": str(workout.id)},
          notification_type="workout_reminder",
      )
```

**Multi-Timezone Desteği:** Her kullanıcı farklı bir timezone'da olabilir. `zoneinfo.ZoneInfo(user.timezone)` ile local datetime hesaplanır. Geçersiz TZ string'i verilirse UTC'ye fallback + log uyarısı.

**Garantiler:**
- Her kullanıcı günde **en fazla 1 kez** workout reminder alır (kendi seçtiği saatte)
- Aynı workout için tekrar tetiklense bile bildirim tekrar gider (deduplication yok — basitlik için). Cron saat başı olduğu için doğal olarak günde 1 kez tetiklenir
- Kullanıcı preference kapatırsa anında etkisi vardır (task her çalıştığında kontrol eder, cache yok)

### Achievement Push (Anlık)

`apps/notifications/signals.py` → `Achievement` post_save:

```python
@receiver(post_save, sender=Achievement)
def create_achievement_notification(sender, instance, created, **kwargs):
    if not created: return
    Notification.objects.create(...)              # in-app notification (eski davranış)
    send_push_notification(                        # yeni — push da gönder
        user=instance.user,
        title="Yeni Rozet Kazandın! 🏆",
        body=f"'{instance.title}' rozetini kazandın, tebrikler!",
        data={"type": "achievement", "achievement_id": str(instance.id)},
        notification_type="achievement",
    )
```

Achievement zinciri tamamen otomatik: `WorkoutResult.save()` → activity signal → user stats güncelle → gamification signal → `Achievement.objects.get_or_create(...)` → notifications signal → **push gönder**.

### Management Command — `setup_periodic_tasks`

Scheduled task'ları DB'ye idempotent şekilde kaydeder. Deployment sırasında her sefer çalıştırılabilir.

```bash
python manage.py setup_periodic_tasks
```

**İç yapı:**

```python
PERIODIC_TASKS = [
    {
        "name": "send_workout_reminders",
        "func": "apps.notifications.tasks.send_workout_reminders",
        "schedule_type": Schedule.CRON,
        "cron": "0 * * * *",
    },
]

# update_or_create(name=...) ile idempotent
```

Gelecekte yeni task eklemek için bu listeye bir dict eklemek yeterli.

### Push Notification Tipleri

| Tip                  | Tetikleyici                              | Toggle alanı                     | Payload data             |
|----------------------|------------------------------------------|----------------------------------|--------------------------|
| `achievement`        | Achievement post_save signal             | `notification_achievements`      | `{ achievement_id }`     |
| `workout_reminder`   | `send_workout_reminders` cron task       | `notification_workout_reminder`  | `{ workout_id, date }`   |
| `weekly_report`      | (Henüz implement edilmedi)               | `notification_weekly_report`     | —                        |
| `plan_update`        | (Henüz implement edilmedi)               | `notification_plan_updates`      | —                        |

### User.preferred_reminder_time Kullanımı

- **Format:** `TimeField`, default `09:00:00`
- **Granülerlik:** Saat bazlı (dakika her zaman `00`). Frontend time picker kullanıcıya sadece `00:00-23:00` arası 24 seçenek sunar
- **Anlam:** "Bu saatte, ertesi gün antrenmanım varsa hatırlatma al." Task sadece `hour` karşılaştırması yapar (`local_now.hour == preferred_reminder_time.hour`)
- **Multi-TZ:** `user.timezone` ile birlikte yorumlanır — kullanıcı hangi TZ'deyse o TZ'nin o saatinde tetiklenir

### Test & Debug (Django Shell)

```python
# 1. Manuel push
from apps.users.models import User
from apps.notifications.push import send_push_notification
user = User.objects.get(email="...")
send_push_notification(user, "Test", "Merhaba", {"test": True})

# 2. Achievement signal tetikle
from apps.gamification.models import Achievement
Achievement.objects.create(user=user, achievement_type="test", title="Test Rozeti", ...)

# 3. Reminder task manuel
from apps.notifications.tasks import send_workout_reminders
send_workout_reminders()   # → {"checked": N, "sent": M}
```

### Expo / EAS Tarafı

Backend'de **hiçbir APNs key, certificate veya FCM sunucu anahtarı tutulmaz.** Bu credential'lar EAS (Expo) tarafında saklanır:

- **APNs Key:** `eas credentials` komutu ile Apple Developer Portal'dan oluşturulur, EAS sunucusuna yüklenir
- **Expo Push API** bu key ile Apple APNs'e gider
- Backend yalnızca Expo'ya HTTP POST atar (Bearer token gerekmez, token request body'sinde)

Bu sayede backend'in secret yönetimi minimal kalır — sadece `.env`'de `EXPO_ACCESS_TOKEN` (opsiyonel, rate limit bypass için) gerekebilir. Şu an bu token kullanılmıyor, `PushClient` varsayılan ayarlarla çalışıyor.

---

## 8. Teknik Notlar

**Lazy Reset (Erteleme Kotası):** Cron job yok. `get_remaining_reschedules()` her çağrıda ay/yıl değişmişse o an sıfırlar.

**Smart Rescheduling:** Geçmişte yapılmamış antrenmanları zincirin başına ekler, tüm zinciri kullanıcının aktif günlerine yeniden dağıtır.

**Rest Day Optimization:** DB'de dinlenme günü tutulmaz, boş günler dinlenme kabul edilir.

**AI Integration:** LangGraph sadece `/api/programs/create_ai_plan/` endpoint'i üzerinden konuşur, doğrudan DB erişimi yoktur.

**Cross-App Relations:** Circular import'u önlemek için string reference kullanılır. Örn: `ForeignKey('programs.Workout', ...)`

**Dynamic Fields:** `active_program_id`, `remaining_tokens`, `can_use_chat` DB'de tutulmaz, her `/me/` isteğinde Serializer hesaplar.

**Auto-Missed Update:** `WorkoutViewSet.get_queryset()` her çağrıda geçmiş tarihli, tamamlanmamış antrenmanları otomatik `missed` yapar.

**Workout Filtering:** `?only_active=true` (aktif program), `?start_date=` ve `?end_date=` query parametreleri desteklenir.

**Database:** SQLite3 (development). Production için PostgreSQL önerilir. Django-Q2 ORM broker aynı DB'yi task queue broker olarak kullanır — ayrı Redis/RabbitMQ gerekmez.

**Storage:** AWS S3 (`your-s3-bucket-name`, eu-central-1) — profil fotoğrafları için. `custom_storages.MediaStorage` kullanılır.

**Task Queue Worker:** `python manage.py qcluster` 7/24 çalışır. Production'da Django container'ında Supervisor ile `gunicorn` yanında ikinci process olarak çalışır — ayrı ECS task gerekmez.

**Dependencies:** `requirements.txt` root'ta tutulur. Kritik paketler: `django`, `djangorestframework`, `djangorestframework-simplejwt`, `google-auth`, `boto3`, `django-storages`, `django-q2`, `exponent-server-sdk`, `croniter`, `python-dotenv`.

**Environment Variables (`.env`):** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_STORAGE_BUCKET_NAME`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — tüm secret'lar `.env`'de tutulur, `.gitignore`'da.

---
