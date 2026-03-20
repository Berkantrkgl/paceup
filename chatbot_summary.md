# 🤖 PaceUp AI Agent & Chatbot Technical Architecture Documentation v2.3

Bu belge, **LangGraph**, **FastAPI** ve **AWS Bedrock** üzerine kurulu PaceUp AI koşu koçu "Spark"ın teknik mimarisini tanımlar.

---

## 0. Project Structure

```
PACEUP-GRAPH-API/
├── main.py              # FastAPI, SSE Stream, DB Context Manager
└── agent/
    ├── agent.py         # StateGraph tanımları, workflow derleme
    └── utils/
        ├── config.py            # Sabitler, Model ID'leri
        ├── helper_agents.py     # Mesaj özetleyici LLM fonksiyonları
        ├── helper_functions.py  # API çağrıları, DB checkpointer, Auth
        ├── nodes.py             # LangGraph düğümleri (Agent, Router, Summarizer)
        ├── prompts.py           # Sistem prompt şablonları
        ├── state.py             # TypedDict State (user_preferences dahil)
        └── tools.py             # UI ve Backend araçları
```

---

## 1. LangGraph State Machine

**Düğümler:**

- **Summarizer Node:** Mesaj sayısı 15'e ulaşınca bağlamı özetler, eski mesajları temizler
- **Agent Node:** Claude Haiku 3.5 çalışır, UI tool response'larını duck typing ile okuyup `user_preferences` state'ine yazar
- **Router (Conditional Edge):** Tool çağrıldıysa `ui_tools` veya `backend_tools` düğümüne dallanır

**Human-in-the-Loop:**

- `interrupt_before=["ui_tools"]` — LLM UI tool çağırınca akış durur
- Frontend form submit edince `role: "tool"` mesajı gelir, akış kaldığı yerden devam eder

**State Yönetimi:**

- `user_preferences` dict'i: koşu günleri, hedef, uzun koşu günü buraya yazılır
- Summarization sonrası bile kaybolmaz
- PostgreSQL `AsyncPostgresSaver` ile `thread_id` bazlı persist edilir — uygulama kapatılıp açılsa sohbet devam eder

---

## 2. Tool Ecosystem

### A. UI Tools (Frontend Tetikleyicileri)

Arka planda işlem yapmaz, `ask_user` SSE eventi ile Frontend'de widget açılmasını tetikler.

| Tool                               | Açıklama                       | Frontend Widget                                                     |
| ---------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `request_runner_profile`           | Fiziksel profil teyidi         | Kilo/boy/cinsiyet/pace kartı, Onayla veya Düzenle                   |
| `request_program_setup`            | Hedef, başlangıç, süre         | 3 adımlı wizard                                                     |
| `request_availability_preferences` | Koşu günleri seçimi            | Haftalık takvim, `preferred_running_days` varsa otomatik dolu gelir |
| `request_plan_confirmation`        | Plan oluşturma öncesi son onay | Mesaj + Evet/Hayır/Custom Input widget'ı                            |

**Frontend'den Gelen Response Formatları:**

```json
// request_runner_profile
{ "status": "confirmed", "weight": "75", "height": "176", "gender": "male", "pace": "6:00", "is_beginner": false }

// request_program_setup
{ "goal": "10K", "mode": "duration", "value": "8", "start_date": "2026-02-23" }

// request_availability_preferences
{ "days": ["Mon", "Wed", "Fri", "Sun"], "long_run": "Sun" }

// request_plan_confirmation
{ "confirmed": true }                    // Evet
{ "confirmed": false }                   // Hayır
{ "confirmed": false, "feedback": "..." } // Custom Input
```

### B. Backend Tools

**`create_workout_plan`** — LLM chat geçmişinden parametreleri çıkarıp direkt tool'a gönderir:

```python
class CreatePlanInput(BaseModel):
    title: str
    start_date: str           # YYYY-MM-DD
    duration_weeks: int
    description: Optional[str]
    selected_days: List[str]  # ["Mon", "Wed", "Fri"]
    long_run_day: Optional[str]
    goal: str
```

---

## 3. Plan Oluşturma Akışı

1. **Parametre Validasyonu** — `selected_days` boşsa LLM'e hata döner
2. **Profil Toplama** — Kullanıcı fiziksel verileri Django API'den çekilir, pace yoksa acemi modu
3. **Planner Bağlamı** — `extract_planner_context()` ile sohbet geçmişinden structured format çıkarılır (yoğunluk tercihi, özel istekler, kısıtlamalar) — narrative özet değil, planner'a doğrudan faydalı bilgi
4. **Slot Havuzu** — Python'da `generate_available_slots` ile `selected_days`'ten müsait günler üretilir, `long_run_day` slotları `[LONG_RUN_DAY]` etiketlenir
5. **LLM Seçimi** — Sonnet 4 slotlara `easy/tempo/interval/long` tiplerini yerleştirir (80/20 kuralı, progressive overload). JSON çıktı `extract_json_from_llm_response()` ile 3 aşamalı parse edilir (code block → direkt JSON → `{...}` regex fallback)
6. **Deterministic Math** — Pace ve süre `calculate_pace_and_duration` ile Python'da hesaplanır, LLM'e bırakılmaz
7. **API Entegrasyonu** — Final obje Django `/programs/create_ai_plan/` endpoint'ine POST edilir

**AI Auto-Decide Mode:** `mode: "ai_decide"` seçilirse LLM ideal hafta sayısını hesaplayıp `duration_weeks`'e koyar.

---

## 4. FastAPI & SSE

**SSE Event Tipleri:**

| Event                   | Açıklama                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `token`                 | LLM metin parçaları (streaming)                                              |
| `ask_user`              | UI widget tetikleyici — `name`, `id`, `input` içerir                         |
| `tool_use_notification` | Backend tool başladı, loading animasyonu tetikler                            |
| `token_usage`           | LLM token kullanım bilgisi — `input_tokens`, `output_tokens`, `total_tokens` |
| `status`                | Stream bitti                                                                 |

**`token_usage` Event Akışı:**

- Her `on_chat_model_end`'de `usage_metadata` yakalanır
- Bedrock `generations` formatından parse edilir (`llm_output.usage` yedek yolu ile)
- Frontend stream bitince biriken token sayısını Django'ya raporlar

**DB Bağlantısı:** Her request'te `async with get_checkpointer() as cp:` context manager — connection leak önlenir.

**JWT:** `helper_functions.py`'deki `call_api`, token süresi dolmak üzereyse proaktif olarak refresh eder.

---

## 5. LLM Model Stratejisi

| Model            | Kullanım                                | Neden           |
| ---------------- | --------------------------------------- | --------------- |
| Claude Haiku 3.5 | Genel sohbet (Agent Node)               | Hızlı, ekonomik |
| Claude Sonnet 4  | Plan oluşturma                          | Güçlü, yaratıcı |
| Nova Lite 2      | Özetleme (Summarizer + Planner Bağlamı) | Hafif, ucuz     |

---

## 6. System Prompt Özeti

- Sadece Türkçe, sadece koşu konuları
- Markdown + emoji, motive edici ton
- Volatile prompt: State'e kaydedilmez, her döngüde kullanıcının güncel verileri enjekte edilir
- **Tool Tekrarı Kuralı:** Chat geçmişinde bir tool'un cevabı varsa ve bilgi değişmiyorsa tekrar çağrılmaz. Kullanıcı bilgiyi güncellemek istiyorsa tekrar çağrılabilir. "Daha zorlayıcı olsun" gibi tercih yorumları güncelleme sayılmaz — `create_workout_plan`'a bağlam olarak iletilir.

**Tool Kullanım Sırası:**

1. `request_runner_profile`
2. `request_program_setup`
3. `request_availability_preferences`
4. `request_plan_confirmation` (son onay)
5. `create_workout_plan` (kullanıcı onayladıktan sonra)

---

## Changelog

### v2.3 → v2.4

- ✅ `request_plan_confirmation` UI tool eklendi — `create_workout_plan` öncesi kullanıcıdan onay alır
- ✅ `message` parametresi ile dinamik onay sorusu frontend'e iletilir
- ✅ Frontend widget: Evet / Hayır / Custom Input seçenekleri
- ✅ System prompt güncellendi — metin olarak onay sormak yerine tool kullanımı zorunlu kılındı

### v2.2 → v2.3

- ✅ Plan oluşturma ADIM 3: `summarize_messages` → `extract_planner_context()` — structured format, planner'a özel
- ✅ `extract_json_from_llm_response()` eklendi — 3 aşamalı güvenli JSON parse (code block / direkt / regex fallback)
- ✅ System prompt'a `TOOL TEKRARI KURALI` eklendi — gereksiz tool tekrarı önlendi
- ✅ Log sistemi `print()` → `logger` ile standardize edildi

### v2.1 → v2.2

- ✅ `token_usage` SSE eventi eklendi — Bedrock `generations` formatından parse
- ✅ Frontend token raporlama akışı dokümante edildi
- ✅ `on_chat_model_end` debug logging eklendi
