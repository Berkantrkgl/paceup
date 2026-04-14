# PaceUp Deployment Runbook

Bu belge PaceUp Django backend'in AWS ECS Fargate üzerindeki **canlı deployment'ını** dokümante eder. "Nasıl kurulacak" kılavuzundan çok, "nasıl kuruldu, hangi kaynaklar var, neyi nasıl değiştirirsin" referansıdır.

**Son canlıya alma:** 2026-04-14
**Canlı URL:** https://your-domain.com/api/
**AWS hesap:** `035711552622` (Frankfurt / eu-central-1)

---

## Mimari (canlı)

```
                    ┌──────────────┐
                    │   Route 53   │  example.com (Z00630773F62NNOLWVTVE)
                    └──────┬───────┘
                           │  your-domain.com (A-alias)
                    ┌──────▼──────┐
                    │     ALB     │  example-alb (shared)
                    │  HTTPS :443 │  *.example.com (ACM)
                    │  HTTP  :80  │  → 301 redirect to HTTPS
                    └──┬──────┬───┘
                       │      │
           /api/* ─────┤      ├───── /chat-stream (rezerve, future FastAPI)
                       ▼
              ┌─────────────────┐
              │   ECS Fargate   │  example-cluster
              │ paceup-django-  │  paceup-django-service (1 task)
              │ service         │  Task def: paceup-django-task:N
              │                 │
              │ supervisord:    │  CPU 256 / MEM 512
              │ ├─ gunicorn x3  │  Port 8000
              │ └─ qcluster     │  ECR: paceup-django:latest
              └────────┬────────┘
                       │
              ┌────────▼──────────────┐
              │    RDS PostgreSQL     │  example-shared-db
              │    db.t4g.micro       │  DB: paceup
              │    Single-AZ, 20 GB   │  Private, SG-only access
              └───────────────────────┘
```

**Region:** `eu-central-1` (Frankfurt) — tüm kaynaklar tek region'da.
**VPC:** Default (`vpc-09b9aae8f0278d750`, `172.31.0.0/16`), 3 AZ'li public subnet üzerinde.

---

## Kaynak Envanteri (canlı ARN/ID'ler)

### Network & VPC

| Kaynak | ID / Değer |
|---|---|
| VPC | `vpc-09b9aae8f0278d750` (default, 172.31.0.0/16) |
| Subnet eu-central-1a | `subnet-04c325948ad0e9724` (172.31.16.0/20) |
| Subnet eu-central-1b | `subnet-0e47234170d5c2af5` (172.31.32.0/20) |
| Subnet eu-central-1c | `subnet-018a077b03acd87c6` (172.31.0.0/20) |

### Security Groups (zincir)

```
Internet ──80/443──▶ example-alb-sg
                         │
                         ▼ 8000
                    paceup-django-ecs-sg
                         │
                         ▼ 5432
                    example-rds-sg
```

| SG | ID | Inbound |
|---|---|---|
| `example-alb-sg` | `sg-08c371e662ba63b26` | 80, 443 from 0.0.0.0/0 (shared for all apps) |
| `paceup-django-ecs-sg` | `sg-06818e3d643bfb53c` | 8000 from `example-alb-sg` |
| `example-rds-sg` | `sg-088355a2bf0cc4c0c` | 5432 from `paceup-django-ecs-sg` (new apps eklendikçe buraya kural eklenecek) |

### Compute & Container

| Kaynak | Değer |
|---|---|
| ECS Cluster | `example-cluster` (Fargate-only, Container Insights off) |
| ECS Service | `paceup-django-service` (desired=1, grace period=120s) |
| Task Definition Family | `paceup-django-task` |
| ECR Repo | `035711552622.dkr.ecr.eu-central-1.amazonaws.com/paceup-django` |
| Image Tag | `latest` (+ her deploy `:<commit-sha>`) |

**Task specs:** Launch type Fargate, OS `Linux/X86_64`, CPU 256, Memory 512, network mode awsvpc, public IP enabled, subnets: 3 AZ'deki default public subnet.

### Load Balancer

| Kaynak | Değer |
|---|---|
| ALB | `example-alb` |
| ALB DNS | `example-alb-2037260324.eu-central-1.elb.amazonaws.com` |
| ALB Zone ID | `Z215JYRZR1TBD5` |
| Target Group (Django) | `paceup-django-tg` (IP type, port 8000, health path `/api/`, success code 200) |
| Listener :80 | Redirect to HTTPS 301 |
| Listener :443 | Forward to `paceup-django-tg` (default action, şimdilik tek app) |

**Health check ayarları:** Interval 30s, timeout 5s, healthy threshold 2, unhealthy threshold 3.

### DNS & Certificate

| Kaynak | Değer |
|---|---|
| Route53 Hosted Zone | `example.com` (`Z00630773F62NNOLWVTVE`) |
| Domain | `your-domain.com` → A-alias → `dualstack.example-alb-...` |
| ACM Certificate | `arn:aws:acm:eu-central-1:035711552622:certificate/e505a6b9-2946-40f1-98b7-36e85516ca9f` |
| ACM SANs | `example.com`, `*.example.com` (wildcard — tüm subdomainler bu tek sertifikayı paylaşır) |

### Database

| Kaynak | Değer |
|---|---|
| RDS Instance | `example-shared-db` |
| Engine | PostgreSQL 16.x |
| Class | `db.t4g.micro` (2 vCPU, 1 GB RAM) |
| Storage | 20 GB gp3, autoscaling off |
| Endpoint | `example-shared-db.c38aiko0w2nk.eu-central-1.rds.amazonaws.com:5432` |
| Public access | No |
| Multi-AZ | No (tek sunucu, dev/test tier) |
| Master username | `postgres` |
| Master password | Secrets Manager (`paceup/django` → `DATABASE_URL` içinde) |
| Deletion protection | Enabled |
| Backup retention | 7 gün |

**Shared kullanım:** Tek RDS instance içinde birden çok database şeklinde kullanılıyor. PaceUp için `paceup` DB'si var. İleride başka app eklenince `CREATE DATABASE otherapp;` → yeni app'in ECS SG'sinden `example-rds-sg`'ye 5432 kuralı → aynı instance'ta çalışır.

### Secrets

| Secret | ARN |
|---|---|
| `paceup/django` | `arn:aws:secretsmanager:eu-central-1:035711552622:secret:paceup/django-ynzS8S` |

**İçerik (key-value):**
- `DJANGO_SECRET_KEY`
- `DATABASE_URL` → `postgres://postgres:<pwd>@<rds-endpoint>:5432/paceup`
- `AWS_STORAGE_BUCKET_NAME` → `your-s3-bucket-name`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

> Task definition `secrets:` bloğunda her key, `<arn>:<key>::` formatında ayrı env var olarak inject edilir. `:AWSCURRENT` versiyonu default kullanılır.

### IAM Roles

| Rol | Arn | Amaç |
|---|---|---|
| `paceup-django-exec-role` | `arn:aws:iam::035711552622:role/paceup-django-exec-role` | ECS agent — ECR pull, CloudWatch logs, Secrets Manager read |
| `paceup-django-task-role` | `arn:aws:iam::035711552622:role/paceup-django-task-role` | Django runtime — S3 bucket RW |

**Policies:**
- `paceup-django-exec-role`:
  - Managed: `AmazonECSTaskExecutionRolePolicy`
  - Inline `paceup-secrets-read`: `secretsmanager:GetSecretValue` on `arn:aws:secretsmanager:eu-central-1:035711552622:secret:paceup/*`
- `paceup-django-task-role`:
  - Inline `paceup-s3-write`: `s3:PutObject/GetObject/DeleteObject/ListBucket` on `your-s3-bucket-name`

**AWS Account global:** `AWSServiceRoleForECS` (service-linked role) — ilk ECS create denemesinde otomatik oluşur. İlk denemede bu rolü oluşturma yarışı nedeniyle create-cluster fail olabilir, tekrar denenince geçer.

### CloudWatch Log Groups

| Log Group | Kaynak |
|---|---|
| `/ecs/paceup-django-task` | ECS Fargate task stdout/stderr (gunicorn + qcluster + entrypoint) |

Stream prefix: `ecs`, stream name format: `ecs/django/<task-id>`.

---

## Maliyet (canlı)

| Bileşen | Tahmini | Shared? |
|---|---|---|
| ALB | ~$16/ay | Tüm app'ler (shared) |
| RDS `db.t4g.micro` 20GB gp3 | ~$16.61/ay (DB $13.87 + storage $2.74) | Tüm app'ler (shared) |
| ECS Fargate task (256 CPU / 512 MEM, 7/24) | ~$9/ay | PaceUp'a özel |
| Route53 Hosted Zone | $0.50/ay | Shared |
| CloudWatch Logs + data transfer | ~$2-3/ay | Değişken |
| **Toplam** | **~$44/ay** | |
| +Her yeni app (sadece task) | **+$9/ay** | — |

---

## Repo Yapısı (deploy ile ilgili dosyalar)

```
paceup-backend/
├── Dockerfile.django          # multi-stage build, python:3.12-slim, supervisor + libpq
├── docker-compose.yml         # lokal: Django + Postgres 16 + healthcheck
├── .dockerignore
├── .env.example               # tüm env var'ların şablonu
├── docker/
│   ├── supervisord.conf       # gunicorn (3 worker) + qcluster tek root conf
│   └── entrypoint.sh          # migrate + collectstatic + setup_periodic_tasks → exec supervisord
├── .github/workflows/
│   └── deploy.yml             # master push → build linux/amd64 → ECR → force-new-deployment
└── paceupbackend/settings.py  # env-driven config, whitenoise, prod hardening
```

### Önemli ayrıntılar

**`settings.py`:**
- `SECRET_KEY = os.environ['DJANGO_SECRET_KEY']` — fallback yok; env yoksa Django açılışta patlar (güvenlik kararı)
- `DATABASE_URL` varsa `dj-database-url` ile parse, yoksa SQLite fallback (lokal dev kolaylığı)
- `whitenoise.middleware.WhiteNoiseMiddleware` + `CompressedManifestStaticFilesStorage` — admin static'lerini `collectstatic` sonrası gunicorn serve eder
- `DEBUG=False` iken: HSTS 1 yıl, `SECURE_PROXY_SSL_HEADER=X-Forwarded-Proto`, cookie secure flags

**`Dockerfile.django`:**
- Base: `python:3.12-slim`
- System deps: `build-essential`, `libpq-dev`, `supervisor`, `curl` (healthcheck)
- `pip install -r requirements.txt` → gunicorn, whitenoise, psycopg[binary], dj-database-url dahil
- HEALTHCHECK: `curl -fsS http://localhost:8000/api/` (container-local, ALB health check'ten bağımsız)
- ENTRYPOINT: `/entrypoint.sh` → CMD: `supervisord`

**`docker/supervisord.conf`:**
- Root config, `nodaemon=true`, PID 1 olarak çalışır
- 2 program: `gunicorn` (3 sync worker, 60s timeout) + `qcluster`
- Her ikisi `autorestart=true`, `startsecs=5`, `stopsignal=TERM`
- stdout/stderr → `/dev/stdout` `/dev/stderr` (CloudWatch'a akar)

**`docker/entrypoint.sh`:**
```
1. python manage.py migrate --noinput
2. python manage.py collectstatic --noinput
3. python manage.py setup_periodic_tasks || echo "skipped"
4. exec "$@"  (→ supervisord)
```

> `migrate` her task start'ında çalışıyor. Django advisory lock sayesinde birden fazla task aynı anda çalışsa bile güvenli (deadlock ve race yok).

**`.github/workflows/deploy.yml`:**
- Trigger: `push` to `master` (path filter: `apps/**`, `paceupbackend/**`, `docker/**`, `Dockerfile.django`, `requirements.txt`, workflow dosyasının kendisi) + `workflow_dispatch`
- Steps:
  1. Checkout
  2. AWS credentials (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` GitHub Secrets'tan)
  3. ECR login
  4. `docker buildx build --platform linux/amd64 -t $REGISTRY/paceup-django:$SHA -t ...:latest --push .`
  5. `aws ecs update-service --force-new-deployment`
  6. `aws ecs wait services-stable` (deployment healthy olmadan job yeşil olmaz)
- Concurrency group: `deploy-django` (aynı anda 2 deploy çakışmasın)

---

## Günlük Operasyon

### Canlıya deploy

`master`'a push yet — workflow her şeyi otomatik yapar. İlerlemeyi GitHub → repo → Actions tab'ından izleyebilirsin.

### Manuel deploy (acil durum)

```bash
aws ecr get-login-password --profile paceup --region eu-central-1 | \
  docker login --username AWS --password-stdin 035711552622.dkr.ecr.eu-central-1.amazonaws.com

docker buildx build --platform linux/amd64 -f Dockerfile.django \
  -t 035711552622.dkr.ecr.eu-central-1.amazonaws.com/paceup-django:latest \
  --push .

aws ecs update-service --profile paceup \
  --cluster example-cluster \
  --service paceup-django-service \
  --force-new-deployment

aws ecs wait services-stable --profile paceup \
  --cluster example-cluster \
  --services paceup-django-service
```

### Log izleme

```bash
# Son 50 log satırı (en yeni task)
TASK=$(aws ecs list-tasks --profile paceup --cluster example-cluster \
  --service-name paceup-django-service --query 'taskArns[0]' --output text | awk -F/ '{print $NF}')

aws logs get-log-events --profile paceup \
  --log-group-name /ecs/paceup-django-task \
  --log-stream-name "ecs/django/$TASK" \
  --limit 50 --query 'events[].message' --output text | tr '\t' '\n'
```

### Service & target health snapshot

```bash
aws ecs describe-services --profile paceup \
  --cluster example-cluster --services paceup-django-service \
  --query 'services[0].[desiredCount,runningCount,deployments[0].[rolloutState,taskDefinition]]'

TG_ARN=$(aws elbv2 describe-target-groups --profile paceup \
  --names paceup-django-tg --query 'TargetGroups[0].TargetGroupArn' --output text)
aws elbv2 describe-target-health --profile paceup --target-group-arn $TG_ARN \
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State]'
```

### Smoke test

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/api/           # → 200
curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/api/users/me/  # → 401
curl -s -o /dev/null -w "%{http_code}\n" http://your-domain.com/api/            # → 301 (HTTPS redirect)
```

### Secret değerini güncelleme

```bash
# Mevcut değeri göster
aws secretsmanager get-secret-value --profile paceup --secret-id paceup/django \
  --query SecretString --output text | jq

# Belirli bir key'i güncelle (ör. DATABASE_URL)
aws secretsmanager put-secret-value --profile paceup --secret-id paceup/django \
  --secret-string '{"DJANGO_SECRET_KEY":"...","DATABASE_URL":"...","AWS_STORAGE_BUCKET_NAME":"...","GOOGLE_CLIENT_ID":"...","GOOGLE_CLIENT_SECRET":"..."}'

# Sonra service'i yeniden başlat ki yeni secret'lar task'a push olsun:
aws ecs update-service --profile paceup --cluster example-cluster \
  --service paceup-django-service --force-new-deployment
```

> Secret update tek başına task'ları etkilemez — ECS sadece task **start** anında secret'ları okur. `--force-new-deployment` şart.

### DB'ye psql ile bağlanma (bastion olmadan)

RDS private olduğu için lokalden direkt bağlanamazsın. İki seçenek:
1. **ECS Exec:** Task definition'ı `enableExecuteCommand=true` ile güncelle + task role'e `ssmmessages:*` permission ekle, sonra `aws ecs execute-command` ile container'a shell'den psql.
2. **SSH tunnel bastion:** Ayrı bir ucuz EC2 t4g.nano, RDS SG'sine ekle, `ssh -L 5432:<rds-endpoint>:5432 bastion` tunneli aç. Ucuz ama ayrı kaynak.

İkisi de şu an kurulu **değil**. DB'ye acil bağlanman gerekirse önce bu altyapıyı kurmamız lazım.

### Rollback

```bash
# Mevcut revizyonları listele
aws ecs list-task-definitions --profile paceup --family-prefix paceup-django-task

# Önceki revizyona dön
aws ecs update-service --profile paceup --cluster example-cluster \
  --service paceup-django-service \
  --task-definition paceup-django-task:<N-1>
```

Her workflow run yeni bir image push eder (`:latest` + `:<sha>`) ama task definition revision aynı kalır — çünkü revision içinde image tag `:latest`. Rollback için ya task definition içinde `:<old-sha>` ile yeni revizyon kaydetmen ya da eski revizyona dönmen gerekir. Acil durumda CLI'den:

```bash
# Yeni revizyon, eski SHA ile
aws ecs describe-task-definition ... > td.json
# ... image'ı :<old-sha> ile değiştir ...
aws ecs register-task-definition --cli-input-json file://td.json
aws ecs update-service --task-definition paceup-django-task:<new-N>
```

---

## Troubleshooting — Oturum Boyu Yaşadıklarımız

Bu bölüm **kurulum sırasında gerçekten karşılaştığımız** sorunları ve çözümlerini içerir. Aynı hatayla karşılaşırsan önce buraya bak.

### 1. `CreateCluster Invalid Request: Unable to assume the service linked role`

**Ne zaman:** İlk kez ECS cluster oluşturmak istediğinde.

**Sebep:** AWS hesabında daha önce hiç ECS kullanılmadıysa `AWSServiceRoleForECS` service-linked role'ü yok. AWS normalde ilk `CreateCluster` isteğinde otomatik oluşturur ama bir race condition nedeniyle ilk istek fail olabilir — role yaratılır ama cluster create başarısız döner.

**Çözüm:**
1. Durumu doğrula:
   ```bash
   aws iam get-role --profile paceup --role-name AWSServiceRoleForECS
   ```
   Eğer bu role varsa (ilk denemen oluşturmuş), tekrar dene — CLI ile:
   ```bash
   aws ecs create-cluster --profile paceup --cluster-name example-cluster \
     --settings name=containerInsights,value=disabled
   ```
2. Eğer rol yoksa manuel oluştur:
   ```bash
   aws iam create-service-linked-role --profile paceup --aws-service-name ecs.amazonaws.com
   ```

### 2. Task sürekli `STOPPED` — RDS password authentication failed

**Ne zaman:** ECS task ilk kalkıyor ama entrypoint `migrate` aşamasında patlıyor.

**CloudWatch log:**
```
psycopg.OperationalError: connection failed: ... FATAL: password authentication failed for user "postgres"
```

**Sebep:** Secrets Manager'daki `DATABASE_URL` içinde **RDS master password'ü yanlış**. Bizim durumda Secrets Manager'a password hiç yazılmamıştı (secret create edilirken alan boş bırakılmış).

**Çözüm:**
1. RDS'deki master password'ü hatırlıyorsan direkt Secrets Manager'a yaz.
2. Hatırlamıyorsan RDS instance'ı güncelleyip password reset et:
   ```bash
   aws rds modify-db-instance --profile paceup \
     --db-instance-identifier example-shared-db \
     --master-user-password '<yeni-güçlü-password>' \
     --apply-immediately
   ```
3. Secrets Manager'da `DATABASE_URL`'i güncelle (yukarıdaki `put-secret-value` komutu).
4. `force-new-deployment` ile task'ı yeniden başlat.

> **Password karakter seçimi:** URL-safe harf+rakam kullan. `@`, `:`, `/`, `?`, `#` gibi özel karakterler DATABASE_URL string'ini bozar, URL-encode gerekir. Pratik: 24 karakter alfanümerik.

### 3. Target group health check fail: `Target.ResponseCodeMismatch` (400)

**Ne zaman:** Django container ayakta, gunicorn dinliyor ama ALB target `unhealthy` diyor, log'da `ResponseCodeMismatch` veya `Target.Timeout`.

**Sebep:** ALB health check `/api/` istekte `Host` header olarak container'ın internal IP'sini kullanıyor (ör. `172.31.12.49`). Django `ALLOWED_HOSTS=your-domain.com` olarak ayarlıysa bu host'u tanımaz, **400 Bad Request** döner.

**Çözüm:** Task definition'da `DJANGO_ALLOWED_HOSTS`'a wildcard da ekle:
```
DJANGO_ALLOWED_HOSTS=your-domain.com,*
```

> `*` eklemek public güvenlik riski gibi görünür ama ALB listener rule'ları zaten sadece `your-domain.com` host'unu forward ediyor — dış dünya başka bir host ile bu task'a ulaşamaz. Sadece internal health check Host header'ı için gerekiyor.

**Alternatif:** Custom middleware ile IP health check path'ini whitelist'e almak, ama bu `*` ile kıyasla çok daha karmaşık.

### 4. Task çöküyor — `healthCheckGracePeriodSeconds=0`

**Ne zaman:** Task başlatılıyor, Django düzgün bootluyor, ama ALB `Target.Timeout` diyor ve task ~60-90 saniye sonra durduruluyor. Sonsuz crash loop.

**Sebep:** ECS Service'in `healthCheckGracePeriodSeconds=0` (default) ise, ALB health check task kalkar kalkmaz başlar. Bizim entrypoint ~25-40 saniyede migrate + collectstatic + gunicorn boot yapıyor. Bu sürede ALB `/api/`'ye istek atar ama port 8000 henüz dinlemiyor veya Django henüz hazır değil → timeout. Unhealthy threshold 3 × interval 30s içinde dolar, task "unhealthy" sayılır ve ECS task'ı durdurur.

**Çözüm:** Service'e 120 saniye grace period ver:
```bash
aws ecs update-service --profile paceup \
  --cluster example-cluster \
  --service paceup-django-service \
  --health-check-grace-period-seconds 120
```

Grace period sırasında ALB health check cevapları göz ardı edilir, task `RUNNING` kabul edilir. Bu süre içinde Django boot tamamlanır, sonraki check'ler gerçek.

> Bizim setup için 120 saniye güvenli bir üst limit. Startup süresi 25-40 saniye arası, 3x marj var.

### 5. ECS deployment stuck — task spawning başlamıyor

**Ne zaman:** `force-new-deployment` çektin ama `pendingCount=0, runningCount=0` olarak takılı kaldı, yeni task başlatmıyor.

**Sebep:** Circuit breaker (deployment failure detection) devreye girdiği birkaç fail'den sonra "bu deployment kaç kere çuvalladıysa yeterince, duruyorum" deyip yeni task spawn'ı geciktiriyor. Normalde rollback yapar ama rollback edecek healthy revision yoksa stuck kalır.

**Çözüm:** Service'i 0'a düşür, sonra 1'e çıkar — internal state reset olur:
```bash
aws ecs update-service --profile paceup \
  --cluster example-cluster --service paceup-django-service --desired-count 0

aws ecs update-service --profile paceup \
  --cluster example-cluster --service paceup-django-service \
  --desired-count 1 --force-new-deployment
```

### 6. Task definition secrets yanlış yerde (console tuzağı)

**Ne zaman:** Console'da task definition oluştururken "Environment variables" bölümünde secret ARN'ını value olarak girdin, container şimdi `GOOGLE_CLIENT_ID=arn:aws:secretsmanager:...` (literal string) görüyor.

**Sebep:** Console UI'da "Environment variables" ve "Secrets" ayrı alt-bölümler. Her ikisi de "Add environment variable" butonu gösteriyor ama farklı. Env var'ların altında "Value type: Value/ValueFrom" dropdown'u var; "ValueFrom" seçeceksin veya doğrudan "Secrets" bölümünü kullanacaksın. Eğer yanlış bölüme yazdıysan container'da secret string literal olarak gelir.

**Çözüm:** CLI ile task definition'ı düzeltip yeni revizyon register et:
```bash
aws ecs describe-task-definition --profile paceup --task-definition paceup-django-task \
  --query taskDefinition > /tmp/td.json

# JSON'u düzenle — SECRET_KEYS'i environment'tan silip secrets'a taşı:
python3 <<'PY'
import json
with open('/tmp/td.json') as f: td = json.load(f)
for k in ['taskDefinitionArn','revision','status','requiresAttributes','compatibilities','registeredAt','registeredBy','enableFaultInjection']:
    td.pop(k, None)
cd = td['containerDefinitions'][0]
SECRET_KEYS = {'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','AWS_STORAGE_BUCKET_NAME'}
PREFIX = 'arn:aws:secretsmanager:eu-central-1:035711552622:secret:paceup/django-ynzS8S:'
cd['environment'] = [e for e in cd['environment'] if e['name'] not in SECRET_KEYS]
existing = {s['name'] for s in cd.get('secrets',[])}
for name in SECRET_KEYS:
    if name not in existing:
        cd['secrets'].append({'name':name,'valueFrom':f'{PREFIX}{name}::'})
with open('/tmp/td.json','w') as f: json.dump(td,f,indent=2)
PY

aws ecs register-task-definition --profile paceup --cli-input-json file:///tmp/td.json
```

### 7. Container başlıyor ama CPU mimarisi uyumsuz — `exec format error`

**Ne zaman:** Mac M-series'te `docker build` yaptın, ECR'ye push ettin, ECS task kalkmıyor, log'da `exec format error`.

**Sebep:** Default build `linux/arm64`, Fargate task definition'ında `Linux/X86_64` seçtiysen image uyumsuz.

**Çözüm:** Her build'de `--platform linux/amd64` zorunlu:
```bash
docker buildx build --platform linux/amd64 -f Dockerfile.django \
  -t <registry>/paceup-django:latest --push .
```

GitHub Actions workflow'unda bu zaten ayarlandı. Lokalde manuel build yaparken unutma.

---

## Gelecek İyileştirmeler

### Yakın vadede (gerektiğinde)

- [ ] **ECS Exec** — `enableExecuteCommand=true` + SSM permission → Django container'a shell ile bağlanıp `manage.py createsuperuser`, `shell_plus` vs. çalıştırabilmek
- [ ] **RDS'ye bastion** — küçük bir EC2 nano ile SSH tunnel, veya ECS Exec üzerinden psql
- [ ] **GitHub Actions OIDC** — IAM user yerine OIDC trust (access key rotasyonu derdi bitsin)
- [ ] **Secret scanning** — GitHub repo settings → "Secret scanning" enabled (public repo için bonus)

### Orta vadede (app büyüyünce)

- [ ] **FastAPI (chatbot) service** — `paceup-chatbot-*` isimlendirmesi, ALB'ye `/chat-stream` listener rule, aynı cluster ve shared RDS
- [ ] **RDS sizing** — PaceUp kullanıcı sayısı artınca `db.t4g.small` ($27/ay)
- [ ] **ECS autoscaling** — CPU %70 üstü olunca ekstra task spawn
- [ ] **Multi-AZ RDS** — failover + SLA, +$13/ay
- [ ] **CloudWatch Alarms + SNS** — service unhealthy olunca email/Slack
- [ ] **Database migration job** — destructive migration'lar için one-off ECS task (şu an her task start'ında migrate çalışıyor, büyük migration'lar için riskli)

### Uzak vadede (multi-app olgunlaşınca)

- [ ] **Per-app environment (staging/prod)** — cluster veya tag bazlı ayrım
- [ ] **Infrastructure as Code** — Terraform veya AWS CDK ile mevcut kurulumu kod'a al
- [ ] **Container Insights** — metric + trace collection (maliyet ~$5/ay ekler, observability değerli olursa)
