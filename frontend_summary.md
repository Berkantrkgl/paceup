# 📱 PaceUp Frontend Technical Architecture Documentation v2.2

Bu belge, **React Native (Expo)** ve **TypeScript** ile geliştirilmiş PaceUp mobil uygulamasının mimarisini, durum yönetimini ve backend entegrasyon mantığını tanımlar.

---

## 1. Application Structure & Navigation

Expo Router (dosya tabanlı yönlendirme) kullanılır.

**Tab Navigation — 4 Sekme:**

1. **Home:** Dashboard, özet veriler, sıradaki antrenman
2. **Calendar:** Sadece aktif programın antrenmanları (`?only_active=true`)
3. **Plans:** Program yönetimi + AI Chatbot erişimi
4. **Profile:** Kullanıcı ayarları, token kullanımı, premium yönetimi

---

## 2. Core Features & Screens

### A. Dashboard (`home/index.tsx`)

- Aktif plan yoksa "İlk Adımı At" kartı + Chatbot yönlendirmesi
- Aktif plan varsa Hero Stats + Next Workout Ticket
- `useFocusEffect` ile her odaklanmada veri yenilenir

### B. Calendar (`calendar/index.tsx`)

- `?only_active=true` parametresiyle sadece aktif plan gösterilir
- Antrenman tiplerine göre renk kodlaması (Tempo, Easy, Interval, Long)
- Durum ikonu: ✅ Tamamlandı / ❌ Kaçırıldı
- Takvim varsayılan olarak bugünün ayını gösterir; antrenmanlar gelecek aydaysa o aya geçmek gerekir

### C. Plans (`plans/index.tsx`)

- Aktif / Geçmiş plan kartları
- **Reschedule Modal:** 14 günlük tarih seçici, sadece programın `running_days` listesindeki günler seçilebilir (backend format: `[0,2,4]` → 0=Pzt), backend slot-filling algoritması
- **Plan Details Modal:** Hafta bazlı gruplandırma, tamamlanmamış ilk antrenmanına otomatik scroll

### D. AI Chatbot (`plans/chatbot.tsx`)

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
    - `ProgramSetupTool`: Hedef/süre/başlangıç tarihi
    - `AvailabilityTool`: Koşu günleri seçimi
- **Token Yönetimi:** Stream bitince biriken token sayısı `/users/update_token_usage/` endpoint'ine POST edilir, `canUseChat` false olunca `PremiumModal` açılır

### E. Profile (`profile/index.tsx`)

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
user: UserData | null   // /users/me/ verileri
token: string | null    // Access token (UI display için)
isLoggedIn: boolean
isReady: boolean
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
export const FASTAPI_URL = "http://127.0.0.1:8001";  // AI Servisi
const BASE_URL = "http://127.0.0.1:8000";
export const API_URL = `${BASE_URL}/api`;             // Django Backend
```

---

## 6. Proje Klasör Yapısı

```
src/
├── app/
│   ├── (protected)/(tabs)/
│   │   ├── home/
│   │   ├── calendar/
│   │   ├── plans/
│   │   │   ├── chatbot.tsx
│   │   │   ├── index.tsx
│   │   │   ├── plan_details.tsx
│   │   │   └── reschedule_modal.tsx
│   │   └── profile/
├── components/
│   ├── chat/tools/
│   │   ├── AvailabilityTool.tsx
│   │   ├── ProgramSetupTool.tsx
│   │   └── RunnerProfileTool.tsx
│   └── PremiumModal.tsx
├── constants/
│   ├── Colors.ts
│   └── Config.ts
├── types/
│   └── plans.ts
└── utils/
    └── authContext.tsx
```

---

## 7. Önemli Notlar & Bilinen Davranışlar

- **Takvim:** Antrenmanlar gelecek bir ayda ise takvim o aya manuel kaydırılmalıdır. Takvim her zaman bugünün ayını varsayılan olarak açar.
- **Reschedule günleri:** Backend `running_days` formatı `[0,2,4]` (0=Pzt). JS `getDay()` dönüşümü için `JS_TO_BACKEND_DAY = [6, 0, 1, 2, 3, 4, 5]` mapping'i kullanılır.
- **Image Picker (iOS):** Modal kapatıldıktan sonra picker açılması için `animationType="none"` + `setTimeout(..., 100)` gereklidir. `MediaTypeOptions` deprecated — `mediaTypes: "images"` string literal kullanılır.
- **`current_pace` null:** Backend `null=True` ile işaretli. Frontend `null` değerini `--:--` gösterir.
