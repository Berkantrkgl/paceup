# 📱 PaceUp Frontend Technical Architecture Documentation v2.7

Bu belge, **React Native (Expo)** ve **TypeScript** ile geliştirilmiş PaceUp mobil uygulamasının mimarisini, durum yönetimini ve backend entegrasyon mantığını tanımlar.

---

## 1. Application Structure & Navigation

Expo Router (dosya tabanlı yönlendirme) kullanılır. **Development build** (`npx expo run:ios`) ile çalıştırılır — native modüller (Google Sign-In vb.) desteklenir.

**Tab Navigation — 4 Sekme:**

| Sekme    | Başlık    | İkon (active / inactive)        |
| -------- | --------- | ------------------------------- |
| Home     | Ana Sayfa | `home` / `home-outline`         |
| Calendar | Takvim    | `calendar` / `calendar-outline` |
| Plans    | Planlama  | `sparkles` / `sparkles-outline` |
| Profile  | Profil    | `walk` / `walk-outline`         |

**Tab Bar:**

- Yükseklik: iOS 96px, Android 72px
- paddingBottom: iOS 34px, Android 12px (iPhone home indicator alanı için genişletilmiş)
- Active tint: `#FF6B35`, inactive tint: `rgba(255,255,255,0.3)`

**Tüm Tab Ekranlarında Tutarlı `paddingTop: 70`** — SafeAreaView yerine manuel padding kullanılır.

---

## 2. Core Features & Screens

### A. Dashboard (`home/index.tsx`)

- Her zaman Hero Stats + **Bugünün Antrenmanı Kartı** gösterilir (eski "İlk Adımı At" onboarding kartı kaldırıldı)
- `useFocusEffect` ile her odaklanmada veri yenilenir, `getValidToken()` kullanılır
- **Bugünün Antrenmanı Kartı** (eski adı: "Sıradaki Antreman"):
  - Full-width kart, LinearGradient arka plan (antrenman tipi rengiyle)
  - Tip pill (solda) + tarih badge (sağda, aynı satırda `space-between`)
  - Meta bilgiler: süre, mesafe, pace (`target_pace_seconds`)
  - **Tamamlandı durumu:** Antrenman `status === "completed"` ise yeşil "Tamamlandı" badge (checkmark ikonlu)
  - **Hızlı Tamamla butonu:** Sadece `isToday && status !== "completed"` ise gösterilir
  - Tamamlama sonrası `fetchNextWorkout()` çağrılarak güncellenir
  - Timezone bug fix: `new Date("YYYY-MM-DD")` UTC parse sorununu önlemek için string karşılaştırması (`en-CA` locale)
- **Karta tıklayınca:** `/(protected)/(tabs)/calendar/workout-detail` ekranına `workoutId` parametresiyle yönlendirilir (eski: `weekly_calendar`)
- **Boş durum:** "Bugün antrenman yok." mesajı, takvime yönlendirme
- **İstatistikleri Görüntüle Kartı:** Accent renkli gradient kart, ikon kutusu, `progress.tsx`'e yönlendirme (eski: "Tüm Planlar" quick link kaldırıldı)

### B. İstatistikler (`home/progress.tsx`)

- **Layout başlığı:** "İstatistikler" (`_layout.tsx`'de tanımlı)
- **Hero Header:** Büyük toplam mesafe değeri (56px font), gradient yok, geri butonu yok (layout sağlar)
- **Mini Stat Satırı:** 4 küçük stat kartı — Seri, Koşu, Süre, Max Seri (ikon kutuları ve divider'larla)
- **Aktif Program Kartı:** Plain `View` + `backgroundColor: COLORS.card` (gradient yok)
- **Tab-Switchable Grafikler:**
  - "Mesafe" ve "Tempo" sekmeleri ile üstten değiştirilebilir
  - Her iki grafik `BarChart` (react-native-chart-kit): mesafe=turuncu, tempo=yeşil
  - Aylık veri (`?period=month`), etiketler her 5 günde bir filtrelenir
- **Detaylı İstatistikler:** Güncel Tempo, Aktif Gün, Bu Hafta (kalori kaldırıldı)
- **Rozetler:** Son başarımlar, rozet rengine göre subtle gradient arka plan

### C. Calendar (`calendar/index.tsx`)

- `?only_active=true` parametresiyle sadece aktif plan gösterilir
- Antrenman tiplerine göre renk kodlaması (Tempo, Easy, Interval, Long)
- Durum ikonu: ✅ Tamamlandı / ❌ Kaçırıldı
- **Özel Ay Navigasyonu:**
  - `Calendar` bileşeni: `enableSwipeMonths={false}`, `hideArrows={true}`, `renderHeader={() => null}`
  - Özel ay başlığı: chevron-back/forward ok butonları (stilize kutular) + Türkçe ay/yıl etiketi
  - `changeMonth(direction)` fonksiyonu ile `LayoutAnimation.Presets.easeInEaseOut` geçiş animasyonu
  - **Manuel swipe gesture:** `onTouchStart`/`onTouchEnd` ile yatay kaydırma algılama
    - Eşik: `|deltaX| > 50px` ve `|deltaX| > |deltaY| * 1.5` (dikey scroll ile çakışmayı önler)
    - Sola swipe → sonraki ay, sağa swipe → önceki ay
  - `CalendarList` denendi ancak ScrollView ile gesture çakışması nedeniyle terk edildi

### E. Planlama (`plans/index.tsx`)

- **Header:** "Planlama" başlığı + alt açıklama metni
- **plans/\_layout.tsx:** Index ekranında `headerShown: false`
- **AI Kartı:** Gradient kart (accent → secondary), sparkles ikonu, "Yeni Plan Oluştur" başlığı, chevron, chatbot'a yönlendirme
- **Aktif Plan Kartı:**
  - "Aktif" badge (flash ikon) + hafta badge ("Hafta X / Y")
  - Başlık + açıklama (max 2 satır)
  - İlerleme: yüzde + antrenman sayısı, gradient progress bar
  - "Arşive Kaldır" aksiyonu (pause ikonu)
- **Arşivlenmiş Planlar:** Tek kart içinde kompakt liste, her plan için play (yeniden aktifle) ve trash (sil) butonları
- **Boş Durum:** Harita ikonu, "Henüz bir planın yok" başlığı, motivasyonel açıklama
- **Reschedule Modal:** 14 günlük tarih seçici, sadece programın `running_days` listesindeki günler seçilebilir (backend format: `[0,2,4]` → 0=Pzt)
- **Plan Details Modal:** Hafta bazlı gruplandırma, tamamlanmamış ilk antrenmanına otomatik scroll

### F. AI Chatbot (`plans/chatbot.tsx`)

- `react-native-sse` ile FastAPI'ye (`/chat-stream`) SSE bağlantısı
- JWT token header'da taşınır
- **SSE Event Tipleri:**
  - `token`: Streaming metin parçaları
  - `ask_user`: UI widget aç (form/modal)
  - `tool_use_notification`: Backend işlem başladı animasyonu
  - `token_usage`: LLM token kullanım bilgisi
- **Human-in-the-Loop:** `ask_user` eventi gelince akış durur, kullanıcı formu doldurup submit edince `role: "tool"` mesajıyla devam eder
- **3 UI Tool Widget:**
  - `RunnerProfileTool`: Fiziksel profil doğrulama
  - `ProgramSetupTool`: Hedef/süre/başlangıç tarihi — başlangıç tarihi için **Bugün / Yarın / Gelecek Pzt** hızlı seçenekleri
  - `AvailabilityTool`: Koşu günleri seçimi
- **Token Yönetimi:** Stream bitince biriken token sayısı `/users/update_token_usage/` endpoint'ine POST edilir, `canUseChat` false olunca Premium ekranı açılır (`router.push`)

### G. Profile (`profile/index.tsx`)

- **SafeAreaView kullanılmaz** — doğrudan `ScrollView` ile `paddingTop: 70`
- **Başlık yok** — profil bölümü doğrudan avatar/kullanıcı adı ile başlar
- Profil fotoğrafı yükleme (expo-image-picker, `mediaTypes: "images"`)
- Avatar'a tıklayınca görüntüleme modalı açılır; modaldan "Profil Fotoğrafı Ekle/Değiştir" butonu ile picker tetiklenir
- Kişisel/fiziksel/koşu bilgileri düzenleme
- **Koşu Günleri:** Chip tabanlı çoklu seçim UI, değişiklik aktif programı etkilemez (yalnızca yeni planlar için baz alınır)
- **Pace:** `null` değeri `--:--` olarak gösterilir; "Pace'imi bilmiyorum" seçeneği `null` gönderir
- **Token Kartı:** Progress bar ile kullanım yüzdesi (%70+ turuncu, %90+ kırmızı), premium kullanıcıda "Sınırsız" badge
- **Hesap Bilgileri:**
  - Üyelik tipi: "Premium (Aylık)" / "Premium (Yıllık)" / "Standart"
  - Abonelik bitiş tarihi (sadece premium, Türkçe format: "21 Mart 2027")
  - Kalan erteleme hakkı (premium: "Sınırsız")
  - **Aboneliği İptal Et:** Sadece premium kullanıcılar için görünür, onay Alert'i sonrası `POST /api/users/cancel_premium/` çağrılır
- Premium ekranına `router.push("/(protected)/premium")` ile yönlendirme

### H. Premium Ekranı (`(protected)/premium.tsx`)

- **Stack screen**, `presentation: "modal"` — iOS native swipe-down gesture ile kapanır
- `(protected)/_layout.tsx`'de tanımlı, `headerShown: false`
- Her tab'dan `router.push({ pathname: "/(protected)/premium", params: { reason } })` ile açılır
- `reason` parametresi: `token_limit` / `feature` / `general` — başlık ve açıklama buna göre değişir
- **Özellikler listesi:** Sınırsız AI koçluğu, sınırsız erteleme, akıllı bildirimler
- **Plan seçimi:** Aylık (₺149) / Yıllık (₺799, %55 tasarruf), radio button selection indicator
- **Satın alma:** `POST /api/users/activate_premium/` → `{ premium_type: "monthly" | "yearly" }` gönderir
- Başarı sonrası `refreshUserData()` + 1.8sn delay ile `router.back()`
- ScrollView ile içerik kaydırılabilir, native modal gesture ile çakışmaz
- Eski `components/PremiumModal.tsx` (RN Modal + PanResponder) kaldırıldı, yerine bu native stack screen geldi

---

## 3. Authentication & Social Login

### Email/Şifre Giriş

- `login.tsx`: Email + şifre ile `POST /api/token/` → JWT access + refresh token
- `register.tsx`: Ad, soyad, email, şifre ile `POST /api/users/` → otomatik login

### Onboarding (`onboarding.tsx`)

- **Tetiklenme:** İlk kez giriş yapan kullanıcılar (`is_onboarded === false`) otomatik yönlendirilir
- **Navigation guard:** `authContext.tsx`'deki `useEffect` — login sonrası `user.is_onboarded === false` ise `/onboarding`'e replace
- **Root layout:** `_layout.tsx`'de `onboarding` screen tanımlı (protected dışında, login/register ile aynı seviyede)
- **7 Step (FlatList + horizontal paging):**
  1. **Cinsiyet** — 3 kart (Erkek/Kadın/Diğer), tek seçim
  2. **Doğum Tarihi** — `DateTimePicker` spinner mode, dark theme
  3. **Boy** — `@react-native-picker/picker` ile kaydırmalı seçim (120-220 cm)
  4. **Kilo** — `@react-native-picker/picker` ile kaydırmalı seçim (30-200 kg)
  5. **Ortalama Pace** — Dakika:Saniye dual picker + "Pace'imi bilmiyorum" checkbox
  6. **Maksimum Koşu Mesafesi** — Picker (1-100 km) + "Bilmiyorum" checkbox
  7. **Koşu Günleri** — Haftalık gün chip seçimi (çoklu seçim)
- **Bilmiyorum seçenekleri:** Pace ve Max Mesafe için — seçildiğinde picker soluklaşır (`opacity: 0.3`, `pointerEvents: "none"`), ilgili alan backend'e gönderilmez (default değerler geçerli: pace=480sn, max_distance=0)
- **Tamamlama:** Son adımda `PATCH /api/users/me/` ile tüm bilgiler + `is_onboarded: true` gönderilir → `refreshUserData()` → navigation guard otomatik olarak ana ekrana yönlendirir
- **Progress bar:** Animated üst çubuk, step ilerledikçe dolur

### App Tour Sistemi

Onboarding tamamlandıktan sonra her tab'da ilk kez açılışta tetiklenen ekran turları. Per-tab boolean alanlarla backend'de takip edilir: `tour_home`, `tour_calendar`, `tour_plans`, `tour_profile`.

**Teknik Yaklaşım:**
- SVG Mask ile spotlight efekti: koyu overlay + `react-native-svg` Mask ile şeffaf delik
- `Animated.createAnimatedComponent(Rect)` ile spotlight geçiş animasyonu
- `measureInWindow` ile hedef elementin pozisyon ölçümü
- Metin, highlight edilen elementin altında veya üstünde (20px gap, alan yetersizse taraf değiştirir)
- Tab bar yüksekliği hesaba katılır (iOS 96px, Android 72px)
- Tamamlanınca `PATCH /api/users/me/` ile `{ tour_X: true }` gönderilir

**Turlar:**
- **HomeTour** (4 adım): Hoş geldin → Bugünün antrenmanı → İstatistik linki → Stats satırı
- **CalendarTour** (2 adım): Takvim görünümü → Antrenman slider'ı (boş/dolu durumu tek ref ile kapsanır)
- **PlansTour** (2 adım): AI chatbot butonu → Plan listesi alanı (boş/dolu durumu tek ref ile kapsanır)
- **ProfileTour** (2 adım): Premium kartı → Kimlik ve fiziksel bilgiler

**UI:** Sadece beyaz metin (text shadow) + Atla/İleri butonları. Ok, dot, kart yok.

### Google Sign-In (Native)

- **Paket:** `@react-native-google-signin/google-signin` (development build gerektirir)
- **Konfigürasyon:** `GoogleSignin.configure()` — `iosClientId` (iOS client) + `webClientId` (backend doğrulama için)
- **`app.json` plugin:** `@react-native-google-signin/google-signin` ile `iosUrlScheme` otomatik eklenir
- **Google Cloud Console:** 2 OAuth client — iOS tipi (native SDK için) + Web tipi (backend token doğrulama için)
- **Akış:**
  1. `GoogleSignin.signIn()` → native Google hesap seçim ekranı açılır
  2. `idToken` alınır
  3. `POST /api/auth/google/` → `{ id_token: "..." }` gönderilir
  4. Backend token'ı doğrular, kullanıcı yoksa oluşturur, JWT access + refresh döner
  5. Token'lar AsyncStorage'a kaydedilir, profil çekilir, giriş tamamlanır
- **Hata yönetimi:** `SIGN_IN_CANCELLED` kodu sessizce yok sayılır (kullanıcı iptal etti)
- Login ve Register ekranlarında aynı `googleSignIn` metodu kullanılır (AuthContext'ten)

### AuthContext — Global State

**Tutulan State:**

```ts
user: UserData | null; // /users/me/ verileri
token: string | null; // Access token (UI display için)
isLoggedIn: boolean;
isReady: boolean;
```

**`UserData` Kritik Alanlar:**

```ts
is_onboarded: boolean                      // false = onboarding tamamlanmamış
tour_home: boolean                         // per-tab tour tamamlanma durumu
tour_calendar: boolean
tour_plans: boolean
tour_profile: boolean
is_premium: boolean
premium_type?: "monthly" | "yearly" | null
premium_expires_at?: string | null          // ISO datetime, backend lazy check ile expire kontrolü
total_tokens_used: number
remaining_tokens: number | null             // null = premium (sınırsız)
can_use_chat: boolean
remaining_reschedules: number
preferred_running_days: number[]            // [0,2,4] → 0=Pzt, 6=Paz
current_pace: number | null                 // saniye/km, null = bilinmiyor
pace_display?: string
```

**Token Yönetimi:**

- `getValidToken()`: Her çağrıda AsyncStorage'dan okur (stale closure yok), token süresi dolmak üzereyse (120sn buffer) refresh token ile otomatik yeniler
- **Race condition koruması:** Birden fazla ekran aynı anda `getValidToken()` çağırsa bile tek bir `/token/refresh/` isteği gönderilir (singleton promise pattern)
- **Network hatasında logout yok:** Sadece refresh token gerçekten geçersizse (HTTP 401) logout tetiklenir; network hatası / timeout durumunda null döner, kullanıcı oturumu korunur
- `refreshUserData()`: `/users/me/` çekerek user state'i günceller — chatbot token güncellemesinden sonra çağrılır
- `googleSignIn()`: Native Google Sign-In SDK ile giriş, backend'e id_token gönderir

**API isteklerinde doğru kullanım:**

```ts
// ✅ Doğru — token otomatik yenilenir
const token = await getValidToken();

// ❌ Yanlış — token expire olmuşsa 401 alınır, yenileme olmaz
const { token } = useContext(AuthContext);
```

---

## 4. Premium & Token Sistemi

**Premium Abonelik Akışı:**

1. Kullanıcı Premium ekranını açar (`router.push("/(protected)/premium")`)
2. Aylık veya Yıllık plan seçer
3. `POST /api/users/activate_premium/` → `{ premium_type: "monthly" | "yearly" }` gönderilir
4. Backend `premium_expires_at` hesaplar (monthly: +30 gün, yearly: +365 gün), `is_premium=true` yapar
5. `refreshUserData()` ile AuthContext güncellenir
6. **Lazy expiry:** Backend `UserSerializer.to_representation()` her serialize'da `check_premium_status()` çağırır — expire olmuşsa otomatik `is_premium=false` yapar

**Abonelik İptali:**

- Profile → Hesap Bilgileri → "Aboneliği İptal Et" (sadece premium)
- Onay Alert'i → `POST /api/users/cancel_premium/`
- Backend: `is_premium=false`, `premium_type=null`, `premium_expires_at=null`

**Token Kullanım Akışı:**

1. Her chat stream'inde FastAPI `token_usage` SSE eventi gönderir
2. Frontend stream bitince biriken token'ı `/users/update_token_usage/` POST eder
3. Response'dan `remaining_tokens` ve `can_use_chat` güncellenir
4. `refreshUserData()` çağrılarak AuthContext ve Profile sayfası senkronize olur
5. `can_use_chat: false` → Premium ekranı otomatik açılır (`reason: "token_limit"`)

---

## 5. API Integration Pattern

```ts
const fetchData = async () => {
  const validToken = await getValidToken(); // otomatik refresh, race condition yok
  if (!validToken) return;

  const response = await fetch(`${API_URL}/endpoint/`, {
    headers: { Authorization: `Bearer ${validToken}` },
  });

  if (response.ok) {
    const data = await response.json();
    const results = Array.isArray(data) ? data : data.results || [];
    setData(results);
  }
};
```

**Config (`constants/Config.ts`):**

```ts
export const FASTAPI_URL = "http://127.0.0.1:8001"; // AI Servisi
const BASE_URL = "http://127.0.0.1:8000";
export const API_URL = `${BASE_URL}/api`; // Django Backend
```

---

## 6. Proje Klasör Yapısı

```
src/
├── app/
│   ├── _layout.tsx                          # Root layout
│   ├── login.tsx                            # Giriş ekranı
│   ├── register.tsx                         # Kayıt ekranı
│   ├── onboarding.tsx                       # Onboarding (7-step, ilk giriş)
│   └── (protected)/
│       ├── _layout.tsx                      # Auth guard layout
│       ├── premium.tsx                      # Premium satın alma ekranı (modal presentation)
│       └── (tabs)/
│           ├── _layout.tsx                  # Tab bar konfigürasyonu
│           ├── (home)/
│           │   ├── _layout.tsx              # Home stack layout
│           │   ├── index.tsx                # Dashboard
│           │   └── progress.tsx             # İstatistikler
│           ├── calendar/
│           │   ├── _layout.tsx              # Calendar stack layout
│           │   ├── index.tsx                # Aylık takvim
│           │   └── workout-detail.tsx       # Antrenman detay
│           ├── plans/
│           │   ├── _layout.tsx              # Plans stack layout
│           │   ├── index.tsx                # Planlama ana ekranı
│           │   ├── chatbot.tsx              # AI Koşu Koçu
│           │   └── plan_details.tsx         # Plan detay
│           └── profile/
│               ├── _layout.tsx              # Profile stack layout
│               └── index.tsx                # Profil ekranı
├── assets/
│   └── images/
│       ├── home/
│       │   └── banner-image.jpeg            # Dashboard hero görseli
│       ├── icon.png                         # Uygulama ikonu
│       ├── splash-icon.png                  # Splash screen
│       ├── favicon.png                      # Web favicon
│       ├── android-icon-foreground.png      # Android adaptive ikon
│       ├── android-icon-background.png
│       └── android-icon-monochrome.png
├── components/
│   ├── chat/
│   │   └── tools/
│   │       ├── AvailabilityTool.tsx          # Koşu günleri seçim widget
│   │       ├── PlanConfirmationTool.tsx      # Plan onay widget
│   │       ├── ProgramSetupTool.tsx          # Hedef/süre/tarih widget
│   │       └── RunnerProfileTool.tsx         # Fiziksel profil widget
│   └── tour/
│       ├── HomeTour.tsx                      # Ana sayfa turu (4 adım)
│       ├── CalendarTour.tsx                  # Takvim turu (2 adım)
│       ├── PlansTour.tsx                     # Planlama turu (2 adım)
│       └── ProfileTour.tsx                   # Profil turu (2 adım)
├── constants/
│   ├── Colors.ts                            # Tema renkleri (COLORS)
│   ├── Config.ts                            # API URL'leri
│   └── Content.ts                           # Statik içerikler
├── types/
│   └── plans.ts                             # Plan/antrenman tipleri
└── utils/
    └── authContext.tsx                       # Auth state, token yönetimi
```

---

## 7. Önemli Notlar & Bilinen Davranışlar

- **Timezone bug (isToday):** `new Date("YYYY-MM-DD")` UTC olarak parse edilir, Türkiye (+3) saatinde yanlış güne kayabilir. Doğru yöntem: `new Date().toLocaleDateString("en-CA")` ile string karşılaştırması veya `new Date(y, m-1, d)` constructor kullanımı.
- **Reschedule günleri:** Backend `running_days` formatı `[0,2,4]` (0=Pzt). JS `getDay()` dönüşümü için `JS_TO_BACKEND_DAY = [6, 0, 1, 2, 3, 4, 5]` mapping'i kullanılır.
- **Image Picker (iOS):** Modal kapatıldıktan sonra picker açılması için `animationType="none"` + `setTimeout(..., 100)` gereklidir. `MediaTypeOptions` deprecated — `mediaTypes: "images"` string literal kullanılır.
- **`current_pace` null:** Backend `null=True` ile işaretli. Frontend `null` değerini `--:--` gösterir.
- **CalendarList horizontal sorunları:** `CalendarList` ile horizontal scroll, `ScrollView` içinde dikey kaydırmayla gesture çakışması yaratır. Bu nedenle `Calendar` + özel ok butonları + manuel swipe gesture tercih edildi.
- **Premium ekranı mimari notu:** Eski `PremiumModal` (RN `Modal` + `PanResponder` ile swipe-to-dismiss) gesture çakışmaları nedeniyle terk edildi. Yerine `(protected)/premium.tsx` stack screen + `presentation: "modal"` kullanıldı — iOS native swipe-down gesture otomatik çalışır, ekstra kod gerektirmez.
- **Development build zorunluluğu:** `@react-native-google-signin/google-signin` native modül gerektirdiğinden Expo Go'da çalışmaz. `npx expo run:ios` ile build alınır. JS kod değişiklikleri hot reload ile yansır, native değişikliklerde (yeni paket, plugin, `app.json`) tekrar build gerekir.
- **Google OAuth client tipleri:** iOS client (native SDK, bundle ID: `com.anonymous.PaceUp`) ve Web client (backend'de `id_token` doğrulama) ayrı tutulur. `expo-auth-session` proxy yöntemi Expo Go'da sorunlu olduğundan terk edildi.
