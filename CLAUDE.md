# 🤖 PaceUp AI Agent & Chatbot Technical Architecture Documentation v3.0

Bu belge, **LangGraph**, **FastAPI** ve **AWS Bedrock** üzerine kurulu PaceUp AI koşu koçu "Spark"ın teknik mimarisini ve prod deployment yapısını tanımlar.

---

## 0. Project Structure

```
PACEUP-GRAPH-API/
├── main.py                        # FastAPI app, SSE stream, auth, /health
├── Dockerfile                     # python:3.12-slim, 2 uvicorn worker, prod
├── .dockerignore                  # .git, .env*, notebook, md vs. hariç
├── .env.example                   # Tüm env var'ların şeması
├── docker-compose.yml             # Lokal dev — host.docker.internal ile Django'ya bağlanır
├── requirements.txt               # Sadece prod bağımlılıkları (24 satır)
├── .github/
│   └── workflows/
│       └── deploy.yml             # ECR build + push, ECS force-new-deployment
└── agent/
    ├── agent.py                   # StateGraph tanımları, workflow derleme
    └── utils/
        ├── config.py              # Model ID'leri, Bedrock region
        ├── helper_agents.py       # Async özetleyici LLM fonksiyonları
        ├── helper_functions.py    # Async httpx API istemcisi, DB checkpointer, auth
        ├── nodes.py               # LangGraph düğümleri (Agent, Router, Summarizer)
        ├── prompts.py             # Sistem prompt şablonları
        ├── state.py               # TypedDict State (user_preferences dahil)
        └── tools.py               # UI ve Backend araçları (async)
```

---

## 1. LangGraph State Machine

**Düğümler:**

- **Summarizer Node:** Mesaj sayısı 50'ye ulaşınca bağlamı özetler, eski mesajları temizler (Nova Lite 2, `ainvoke`)
- **Agent Node:** Claude Haiku 4.5 çalışır, UI tool response'larını duck typing ile okuyup `user_preferences` state'ine yazar
- **Router (Conditional Edge):** Tool çağrıldıysa `ui_tools` veya `backend_tools` düğümüne dallanır

**Human-in-the-Loop:**

- `interrupt_before=["ui_tools"]` — LLM UI tool çağırınca akış durur
- Frontend form submit edince `role: "tool"` mesajı gelir, akış kaldığı yerden devam eder

**State Yönetimi:**

- `user_preferences` dict'i: koşu günleri, hedef, uzun koşu günü buraya yazılır
- Summarization sonrası bile kaybolmaz
- PostgreSQL `AsyncPostgresSaver` ile `thread_id` bazlı persist edilir — prod'da Django ile aynı RDS instance paylaşılır, uygulama kapatılıp açılsa sohbet devam eder

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

**`create_workout_plan`** (async) — LLM chat geçmişinden parametreleri çıkarıp direkt tool'a gönderir:

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

Tool async olarak çalışır — `llm.ainvoke` ile Sonnet 4'e planlama için soru sorar, `await call_api` ile Django'ya POST eder. Event loop bloklanmaz.

---

## 3. Plan Oluşturma Akışı

1. **Parametre Validasyonu** — `selected_days` boşsa LLM'e hata döner
2. **Profil Toplama** — Kullanıcı fiziksel verileri Django API'den çekilir (`await call_api`), pace yoksa acemi modu
3. **Planner Bağlamı** — `extract_planner_context()` ile sohbet geçmişinden structured format çıkarılır (yoğunluk tercihi, özel istekler, kısıtlamalar) — narrative özet değil, planner'a doğrudan faydalı bilgi
4. **Slot Havuzu** — Python'da `generate_available_slots` ile `selected_days`'ten müsait günler üretilir, `long_run_day` slotları `[LONG_RUN_DAY]` etiketlenir
5. **LLM Seçimi** — Sonnet 4 slotlara `easy/tempo/interval/long` tiplerini yerleştirir (80/20 kuralı, progressive overload). JSON çıktı `extract_json_from_llm_response()` ile 3 aşamalı parse edilir (code block → direkt JSON → `{...}` regex fallback)
6. **Deterministic Math** — Pace ve süre `calculate_duration` ile Python'da hesaplanır, LLM'e bırakılmaz
7. **API Entegrasyonu** — Final obje Django `/programs/create_ai_plan/` endpoint'ine POST edilir

**AI Auto-Decide Mode:** `mode: "ai_decide"` seçilirse LLM ideal hafta sayısını hesaplayıp `duration_weeks`'e koyar.

---

## 4. FastAPI & SSE

**Endpoint'ler:**

| Endpoint       | Auth       | Açıklama                                             |
| -------------- | ---------- | ---------------------------------------------------- |
| `GET /health`  | —          | ALB target group health check (200 OK, no-op)        |
| `POST /chat-stream` | JWT   | Ana SSE akışı — LangGraph workflow'u tetikler        |

**SSE Event Tipleri:**

| Event                   | Açıklama                                                                     |
| ----------------------- | ---------------------------------------------------------------------------- |
| `token`                 | LLM metin parçaları (streaming)                                              |
| `ask_user`              | UI widget tetikleyici — `name`, `id`, `input` içerir                         |
| `tool_use_notification` | Backend tool başladı, loading animasyonu tetikler                            |
| `token_usage`           | LLM token kullanım bilgisi — `input_tokens`, `output_tokens`, `total_tokens` |
| `status`                | Stream bitti                                                                 |
| `error`                 | Stream sırasında exception (`content` alanında mesaj)                        |

**`token_usage` Event Akışı:**

- Her `on_chat_model_end`'de `usage_metadata` yakalanır
- `extract_usage_metadata()` yardımcısı 3 fallback'le parse eder (direct attr → dict key → Bedrock `generations` formatı)
- Frontend stream bitince biriken token sayısını Django'ya raporlar

**DB Bağlantısı:** Her request'te `async with get_checkpointer() as cp:` context manager — connection leak önlenir. Checkpointer `DB_URI` ya da `DATABASE_URL` env var'ını okur (Django secret'i paylaşabilmek için).

**Auth (JWT):**

- `DJANGO_SECRET_KEY` env var'ı ile HS256 imza doğrulaması — Django ile ortak sır
- Eski `"django-insecure-xxxx"` fallback kaldırıldı — env var yoksa startup'ta `RuntimeError`
- `verify_token` artık `ExpiredSignatureError` (401 expired) ve `InvalidTokenError` (401 invalid) ayırıyor

**Async HTTP İstemcisi (`helper_functions.call_api`):**

- `httpx.AsyncClient` (module-level singleton, 100 connection pool, 30s default timeout)
- `requests` kütüphanesinden tamamen çıkıldı — event loop artık bloklanmaz
- Token süresi dolmak üzereyse proaktif `refresh_access_token` çağırır
- 401 dönerse bir kez refresh + retry
- Timeout `BACKEND_HTTP_TIMEOUT` env var'ı ile override edilebilir

**CORS:**

- `ALLOWED_ORIGINS` env var'ından okunur (virgüllü liste)
- Prod: `https://your-domain.com,https://chatbot.your-domain.com`
- Dev'de boş bırakılırsa `["*"]` (sadece geliştirme için)

---

## 5. LLM Model Stratejisi

| Model            | Kullanım                                 | Neden           | Bedrock Model ID                                       |
| ---------------- | ---------------------------------------- | --------------- | ------------------------------------------------------ |
| Claude Haiku 4.5 | Genel sohbet (Agent Node)                | Hızlı, ekonomik | `eu.anthropic.claude-haiku-4-5-20251001-v1:0`          |
| Claude Sonnet 4  | Plan oluşturma                           | Güçlü, yaratıcı | `eu.anthropic.claude-sonnet-4-20250514-v1:0`           |
| Nova Lite 2      | Özetleme (Summarizer + Planner Bağlamı)  | Hafif, ucuz     | `eu.amazon.nova-2-lite-v1:0`                           |

Tüm modeller **cross-region inference profile** olarak kullanılır (`eu.` prefix). IAM task role'ünde `bedrock:InvokeModel*` hem `foundation-model/*` hem `inference-profile/*` resource'larını kapsar.

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

## 7. Environment Variables

Prod'da tüm env var'lar ECS task definition üzerinden enjekte edilir. Dev'de `.env` dosyası kullanılır (`.env.example` şemasına bakın).

| Variable                | Zorunlu | Açıklama                                                                             |
| ----------------------- | ------- | ------------------------------------------------------------------------------------ |
| `DJANGO_SECRET_KEY`     | ✅       | Django ile ortak, JWT HS256 imza doğrulaması. Yoksa startup fail                     |
| `DB_URI` / `DATABASE_URL` | ✅     | LangGraph `AsyncPostgresSaver` için Postgres connection string. Django ile aynı RDS  |
| `BACKEND_URL`           | ✅       | Django REST API base (trailing slash olmadan, `/api` ile bitmeli)                    |
| `BACKEND_HTTP_TIMEOUT`  | —       | httpx timeout (sn, default 30)                                                       |
| `ALLOWED_ORIGINS`       | —       | CORS origin listesi (virgüllü). Boşsa `*`                                            |
| `AWS_DEFAULT_REGION`    | ✅       | Bedrock region, `eu-central-1`                                                       |
| `LOG_LEVEL`             | —       | DEBUG/INFO/WARNING/ERROR (default INFO)                                              |

**Prod'da creds:**

- `DJANGO_SECRET_KEY` ve `DATABASE_URL` → Secrets Manager `paceup/django` (Django ile ortak secret)
- AWS Bedrock credentials → **ECS task role** (inline key yok, `paceup-graph-api-task-role`)

**Önemli davranış değişikliği:** `load_dotenv(override=False)` — ECS env var'ları `.env` dosyasının içeriğini **ezemez**. Eski `override=True` bir güvenlik açığıydı (prod'a yanlışlıkla baked .env gitse env var'ları bozardı).

---

## 8. AWS Production Architecture

### 8.1 DNS Mimarisi

| Hostname                              | Hedef                | Kullanım                                   |
| ------------------------------------- | -------------------- | ------------------------------------------ |
| `api.your-domain.com`          | Django ECS (Graph TG yok) | Django REST API                            |
| `chatbot.your-domain.com`      | Graph-API ECS        | FastAPI SSE chat stream                    |
| `your-domain.com` (legacy)     | Django ECS           | Geçiş dönemi, frontend tamamen migrate olunca silinecek |

Route53 hosted zone: `example.com` (`Z00630773F62NNOLWVTVE`). Her iki yeni subdomain de ALB'ye **A alias** kayıtları ile bağlı.

### 8.2 ALB & TLS

- **Load Balancer:** `example-alb` (tek ALB, her iki servisi host-based routing ile ayırıyor)
- **HTTPS Listener (443):** Host-based rules
  - Priority **10:** `host-header=api.your-domain.com` → `paceup-django-tg`
  - Priority **20:** `host-header=chatbot.your-domain.com` → `paceup-graph-api-tg`
  - Default: `paceup-django-tg` (legacy domain için)
- **HTTP Listener (80):** HTTPS'e 301 redirect
- **ACM Certs (SNI):**
  - `*.example.com` (eski, `your-domain.com` için)
  - `*.your-domain.com` + `your-domain.com` (yeni, iki yeni subdomain için — DNS validated)

**Dikkat:** Wildcard cert sadece tek seviyede çalışır. `*.example.com` → `your-domain.com` ✅ ama `chatbot.your-domain.com` ❌. Bu yüzden 2 seviye derinlik için ayrı cert gerekti.

### 8.3 Target Group — `paceup-graph-api-tg`

- **Protocol/Port:** HTTP / 8001
- **Target Type:** IP (Fargate awsvpc)
- **Health Check:** `GET /health`, 30s interval, 5s timeout, healthy 2, unhealthy 3
- **Deregistration Delay:** 30s (SSE için düşürüldü — default 300s uzun stream'leri gereksiz tutar)
- **Algorithm:** `least_outstanding_requests` (SSE için özellikle iyi — uzun süren stream'ler yeni task'lara yönlendirilmez)

### 8.4 ECS — `paceup-graph-api-service`

- **Cluster:** `example-cluster` (Django ile aynı)
- **Task Definition:** `paceup-graph-api-task:1`
  - Fargate, 512 CPU / 1024 MiB
  - Container port 8001, awsvpc network mode
  - 2 uvicorn worker
- **Service:**
  - Desired count: 1
  - Deployment: circuit breaker + rollback, 100% min / 200% max
  - Health check grace period: 60s
- **Public Subnets:** Django ile aynı 3 subnet, `assignPublicIp=ENABLED`
- **Security Group:** `sg-06818e3d643bfb53c` (Django task SG ile ortak) — port 8001 ALB SG'den açık

### 8.5 IAM Rolleri

| Role                           | Trust           | Permissions                                                                 |
| ------------------------------ | --------------- | --------------------------------------------------------------------------- |
| `paceup-graph-api-exec-role`   | `ecs-tasks`     | `AmazonECSTaskExecutionRolePolicy` + inline `paceup-secrets-read` (`paceup/*`) |
| `paceup-graph-api-task-role`   | `ecs-tasks`     | Inline `paceup-bedrock-invoke` — `foundation-model/*` + `inference-profile/*` |

Task role'ü Bedrock Claude + Nova Lite 2 modellerinin **hepsini** kapsar — `foundation-model/*` glob'u tüm provider'ları, `inference-profile/*` ise cross-region inference profile'larını içerir.

### 8.6 Observability

- **CloudWatch Log Group:** `/ecs/paceup-graph-api-task` — 30 gün retention
- **Log Stream Prefix:** `ecs` — her task için ayrı stream
- **Format:** `asctime levelname [logger_name] message` (prod-friendly, renkli ANSI yok)

### 8.7 Secrets

Secrets Manager `paceup/django` (Django ile ortak):

- `DJANGO_SECRET_KEY` — JWT HS256 ortak sır
- `DATABASE_URL` — graph-api aynı RDS'e bağlanır, `DB_URI` veya `DATABASE_URL` ikisini de okur

Graph-api için ayrı secret yaratılmadı — ortak sır olduğu için rotation koordinasyonu tek noktadan yapılır.

---

## 9. CI/CD — GitHub Actions

**Workflow:** `.github/workflows/deploy.yml`

Tetikleyiciler:

- `master` branch'e push (path filter: `agent/**`, `main.py`, `requirements.txt`, `Dockerfile`, `.dockerignore`, workflow dosyası)
- `workflow_dispatch` (manuel tetikleme)

Adımlar:

1. **Checkout**
2. **Configure AWS credentials** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` repo secrets'tan)
3. **ECR login**
4. **Buildx** (`linux/amd64` platform)
5. **Build & push** — `$REGISTRY/paceup-graph-api:$SHA` + `:latest`
6. **`aws ecs update-service --force-new-deployment`** — rolling deploy
7. **`aws ecs wait services-stable`** — deployment tamamlanana kadar bekle

Concurrency group: `deploy-graph-api` (cancel-in-progress: false). Birden fazla push aynı anda gelirse sırayla çalışır, hiç iptal olmaz.

**İlk kurulumdan sonra GitHub tarafında yapılması gerekenler:**

- Repo secret'ları: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (IAM user `paceup.cli.user` — Django repo'sundaki ile aynı)
- İlk image elle build edildi (`docker buildx build --push`) — sonraki deploy'lar workflow ile otomatik

---

## 10. Local Development

### 10.1 Klasik uvicorn

```bash
uvicorn main:app --reload --port 8001
```

Gereksinim: `.env` dosyasında en az `DJANGO_SECRET_KEY` ve `DB_URI` olmalı. Yoksa startup'ta `RuntimeError` atar.

### 10.2 Docker Compose

```bash
docker-compose up --build
```

`docker-compose.yml` `host.docker.internal` üzerinden local Django'ya (`:8000`) ve local Postgres'e bağlanacak şekilde ayarlı. Env var'lar host ortamından devralınır (`${DJANGO_SECRET_KEY:-dev-secret-key-change-me}` pattern'i).

### 10.3 Local JWT Secret Uyarısı

Frontend prod Django'dan (`api.your-domain.com`) token alıyorsa, o token prod `DJANGO_SECRET_KEY` ile imzalıdır. Local uvicorn farklı secret ile doğrulamaya çalışınca **401 Unauthorized** döner.

Çözüm A — prod secret'i local'e al (hızlı):

```bash
aws secretsmanager get-secret-value --secret-id paceup/django --profile paceup \
  --query SecretString --output text \
  | python3 -c "import json,sys; print(json.loads(sys.stdin.read())['DJANGO_SECRET_KEY'])"
```

Çıkan değeri `.env`'deki `DJANGO_SECRET_KEY=` satırına yapıştır. **Dikkat:** `BACKEND_URL` da prod'a gidiyorsa `create_workout_plan` gerçek prod user'ına plan oluşturur.

Çözüm B — tam local stack (izolasyon):

- Local Django `python manage.py runserver`
- `.env`'de `DJANGO_SECRET_KEY` Django `settings.py`'daki ile eşit
- `BACKEND_URL=http://localhost:8000/api`
- Frontend `BASE_URL` / `FASTAPI_URL` local'e yönlendirilir

---

## Changelog

### v2.4 → v3.0 — Production Deployment

**Kod — Prod readiness refactor:**

- ✅ `main.py` yeniden yazıldı — `/health` endpoint, fail-fast `DJANGO_SECRET_KEY`, `ExpiredSignature` / `InvalidToken` ayrımı, `ALLOWED_ORIGINS` env var, `token_usage` parse helper fonksiyonlara ayrıldı
- ✅ **`requests` → `httpx.AsyncClient`** tam migration — `call_api`, `refresh_access_token`, `fetch_user_context_data`, `fetch_user_info_for_program_creation` hepsi async
- ✅ `create_workout_plan` tool async'e çevrildi — `llm.ainvoke` + `await call_api`
- ✅ `helper_agents.py` async'e çevrildi — `summarize_messages`, `extract_planner_context` `ainvoke`
- ✅ `nodes.py` temizlendi — renkli Colors debug print'leri kaldırıldı, explicit imports
- ✅ `load_dotenv(override=False)` — ECS env var'ları `.env` ile ezilemez (güvenlik açığı kapandı)
- ✅ `DB_URI` veya `DATABASE_URL` ikisi de okunuyor (Django secret paylaşımı için)
- ✅ `requirements.txt` 80 → 24 satır (dev-only jupyter/ipykernel/debugpy/matplotlib kaldırıldı, `httpx` eklendi, `psycopg[binary]`)

**Deployment — AWS ECS:**

- ✅ Dockerfile eklendi (python:3.12-slim, 2 uvicorn worker, `/health` healthcheck, `--proxy-headers`)
- ✅ `.dockerignore`, `.env.example`, `docker-compose.yml` (lokal dev)
- ✅ GitHub Actions workflow (`deploy.yml`) — ECR build + push, ECS force-new-deployment
- ✅ AWS infrastructure kuruldu:
  - ECR repo `paceup-graph-api`
  - IAM roller (exec + task, Bedrock foundation-model + inference-profile)
  - Task definition (Fargate 512/1024)
  - Target group `paceup-graph-api-tg` (SSE için `least_outstanding_requests`, dereg 30s)
  - ECS service `paceup-graph-api-service` (circuit breaker + rollback)
  - Security group inbound 8001 from ALB SG
  - ACM cert `*.your-domain.com` + `your-domain.com` (DNS validated)
  - ALB listener rules (host-based: `api.paceup.` → Django TG, `chatbot.paceup.` → Graph TG)
  - Route53 A alias records
- ✅ Django task definition v4 — `DJANGO_ALLOWED_HOSTS` + `CSRF_TRUSTED_ORIGINS`'a `api.your-domain.com` eklendi

**Doğrulama:**

- `https://chatbot.your-domain.com/health` → `{"status":"ok"}`
- `https://chatbot.your-domain.com/chat-stream` (no auth) → `401 Unauthorized`
- `https://api.your-domain.com/api/` → Django root
- `https://your-domain.com/api/` (legacy) — hala çalışıyor
- CloudWatch log'larında startup error yok

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
