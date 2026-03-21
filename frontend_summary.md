# 📱 PaceUp Frontend Technical Architecture Documentation v2.4

Bu belge, **React Native (Expo)** ve **TypeScript** ile geliştirilmiş PaceUp mobil uygulamasının mimarisini, durum yönetimini ve backend entegrasyon mantığını tanımlar.

---

## 1. Application Structure & Navigation

Expo Router (dosya tabanlı yönlendirme) kullanılır.

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

- Aktif plan yoksa "İlk Adımı At" kartı + Chatbot yönlendirmesi
- Aktif plan varsa Hero Stats + **Bugünün Antrenmanı Kartı**
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
- **Token Yönetimi:** Stream bitince biriken token sayısı `/users/update_token_usage/` endpoint'ine POST edilir, `canUseChat` false olunca `PremiumModal` açılır

### G. Profile (`profile/index.tsx`)

- **SafeAreaView kullanılmaz** — doğrudan `ScrollView` ile `paddingTop: 70`
- **Başlık yok** — profil bölümü doğrudan avatar/kullanıcı adı ile başlar
- Profil fotoğrafı yükleme (expo-image-picker, `mediaTypes: "images"`)
- Avatar'a tıklayınca görüntüleme modalı açılır; modaldan "Profil Fotoğrafı Ekle/Değiştir" butonu ile picker tetiklenir
- Kişisel/fiziksel/koşu bilgileri düzenleme
- **Koşu Günleri:** Chip tabanlı çoklu seçim UI, değişiklik aktif programı etkilemez (yalnızca yeni planlar için baz alınır)
- **Pace:** `null` değeri `--:--` olarak gösterilir; "Pace'imi bilmiyorum" seçeneği `null` gönderir
- **Token Kartı:** Progress bar ile kullanım yüzdesi (%70+ turuncu, %90+ kırmızı), premium kullanıcıda "Sınırsız" badge
- **Hesap Bilgileri:** Üyelik tipi, kalan erteleme hakkı
- `PremiumModal` entegrasyonu

---

## 3. Global State — `AuthContext`

**Tutulan State:**

```ts
user: UserData | null; // /users/me/ verileri
token: string | null; // Access token (UI display için)
isLoggedIn: boolean;
isReady: boolean;
```

**`UserData` Kritik Alanlar:**

```ts
is_premium: boolean
total_tokens_used: number
remaining_tokens: number | null   // null = premium (sınırsız)
can_use_chat: boolean
remaining_reschedules: number
preferred_running_days: number[]  // [0,2,4] → 0=Pzt, 6=Paz
current_pace: number | null       // saniye/km, null = bilinmiyor
pace_display?: string
```

**Token Yönetimi:**

- `getValidToken()`: Her çağrıda AsyncStorage'dan okur (stale closure yok), token süresi dolmak üzereyse (120sn buffer) refresh token ile otomatik yeniler
- **Race condition koruması:** Birden fazla ekran aynı anda `getValidToken()` çağırsa bile tek bir `/token/refresh/` isteği gönderilir (singleton promise pattern)
- **Network hatasında logout yok:** Sadece refresh token gerçekten geçersizse (HTTP 401) logout tetiklenir; network hatası / timeout durumunda null döner, kullanıcı oturumu korunur
- `refreshUserData()`: `/users/me/` çekerek user state'i günceller — chatbot token güncellemesinden sonra çağrılır

**API isteklerinde doğru kullanım:**

```ts
// ✅ Doğru — token otomatik yenilenir
const token = await getValidToken();

// ❌ Yanlış — token expire olmuşsa 401 alınır, yenileme olmaz
const { token } = useContext(AuthContext);
```

---

## 4. Premium & Token Sistemi

**Akış:**

1. Her chat stream'inde FastAPI `token_usage` SSE eventi gönderir
2. Frontend stream bitince biriken token'ı `/users/update_token_usage/` POST eder
3. Response'dan `remaining_tokens` ve `can_use_chat` güncellenir
4. `refreshUserData()` çağrılarak AuthContext ve Profile sayfası senkronize olur
5. `can_use_chat: false` → `PremiumModal` otomatik açılır

**`PremiumModal` (`components/PremiumModal.tsx`):**

- Alttan kayan bottom sheet, `reason` prop'u ile başlık değişir (`token_limit` / `feature` / `general`)
- Aylık / Yıllık plan seçimi
- Demo satın alma: `/users/activate_premium/` POST → `is_premium: true` yapar
- Her yerden `<PremiumModal visible={...} onClose={...} reason="..." />` ile kullanılır

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
│   └── (protected)/
│       ├── _layout.tsx                      # Auth guard layout
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
│   ├── PremiumModal.tsx                     # Premium satın alma bottom sheet
│   └── chat/
│       └── tools/
│           ├── AvailabilityTool.tsx          # Koşu günleri seçim widget
│           ├── PlanConfirmationTool.tsx      # Plan onay widget
│           ├── ProgramSetupTool.tsx          # Hedef/süre/tarih widget
│           └── RunnerProfileTool.tsx         # Fiziksel profil widget
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
