# PaceUp Deployment Yol Haritası

## Mimari

```
                    ┌──────────────┐
                    │   Route 53   │  example.com
                    └──────┬───────┘
                           │  your-domain.com → ALB
                    ┌──────▼──────┐
                    │     ALB     │  (Shared — path-based routing)
                    │  HTTPS :443 │
                    └──┬──────┬───┘
                       │      │
           /api/* ─────┤      ├───── /chat-stream (reserved)
                       │      │
              ┌────────▼┐  ┌──▼────────┐
              │ ECS Task│  │ ECS Task  │
              │ Django  │  │ FastAPI   │
              │ :8000   │  │ :8001     │  (ileride)
              │gunicorn │  └───────────┘
              │+qcluster│
              │(supervisr)│
              └────┬────┘
                   │
              ┌────▼──────────────────┐
              │    RDS PostgreSQL     │  (Shared)
              │    (db.t4g.micro)     │
              └───────────────────────┘
```

**Domain:** `your-domain.com` (Route53 hosted zone `example.com` altında)

**Path Routing (ALB):**
- `/api/*` → Django target group
- `/chat-stream` → FastAPI target group (rezerve, şu an kullanılmıyor)

### Maliyet Tahmini

| Bileşen | Maliyet | Paylaşımlı? |
|---------|---------|-------------|
| ALB | ~$16/ay | Tüm app'ler |
| RDS db.t4g.micro (20GB gp3) | ~$13/ay | Tüm app'ler |
| ECS Task Django (256 CPU / 512 MEM Fargate) | ~$9/ay | PaceUp |
| Route53 Hosted Zone | $0.50/ay | example |
| Data transfer + CloudWatch logs | ~$2-3/ay | — |
| **PaceUp toplam (şu an)** | **~$40/ay** | |
| **+FastAPI eklendiğinde** | **+$9/ay** | |

---

## Faz 0 — Kod Hazırlığı (Lokalde) ✅

> Henüz AWS'ye dokunmuyoruz, kodu production-ready yapıyoruz

- [x] **requirements.txt** — `gunicorn`, `whitenoise`, `psycopg[binary]`, `dj-database-url` eklendi
- [x] **settings.py** — env-driven (`DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `DJANGO_CSRF_TRUSTED_ORIGINS`), whitenoise middleware + `CompressedManifestStaticFilesStorage`, prod hardening (`HSTS`, `SECURE_PROXY_SSL_HEADER`, secure cookies — `DEBUG=False` iken)
- [x] **Dockerfile.django** — `python:3.12-slim`, supervisor + libpq, healthcheck
- [x] **docker/supervisord.conf** — gunicorn (3 worker) + qcluster tek container'da
- [x] **docker/entrypoint.sh** — `migrate` + `collectstatic` + `setup_periodic_tasks` → `exec supervisord`
- [x] **docker-compose.yml** — Django + Postgres 16 (lokal dev)
- [x] **.env.example** — tüm env var'ları dokümante edildi
- [x] **.dockerignore** — git, venv, sqlite, docs hariç
- [x] **Lokal test** — `docker compose up` → migrate + collectstatic + qcluster + gunicorn sağlıklı, `GET /api/` → 200, `GET /api/users/me/` → 401

### Lokal çalıştırma

```bash
docker compose up -d           # build + start (Django + Postgres)
docker compose logs -f django  # canlı log
docker compose down            # durdur
docker compose down -v         # durdur + DB volume sil
```

---

## Faz 1 — AWS Altyapısı (Tek seferlik kurulum)

> Shared infra — tüm app'lerin kullanacağı temel. Region: **eu-central-1 (Frankfurt)**.

### 1.1 VPC & Subnet'ler

- [ ] Default VPC kullan (yeni hesapsa `172.31.0.0/16` zaten vardır)
- [ ] 2 public subnet (AZ-a + AZ-b) → ALB bunlara bağlanır
- [ ] 2 private subnet (AZ-a + AZ-b) → RDS + ECS task burada (ECS Fargate public IP ile de çalışabilir, maliyet için public subnet + public IP en ucuzu — NAT gateway $32/ay tutmaz)
- **Pratik tercih:** İlk deploy için ECS task'ı **public subnet'te** + `assignPublicIp: ENABLED` ile çalıştır (NAT'dan kaçın). RDS'yi ayrı SG ile koru.

### 1.2 RDS PostgreSQL

- [ ] **Engine:** PostgreSQL 16.x
- [ ] **Template:** Free tier yoksa → Dev/Test
- [ ] **DB instance identifier:** `example-shared-db`
- [ ] **Master username:** `postgres`
- [ ] **Master password:** Secrets Manager'a at (random 24-char) — `example/rds/postgres-master`
- [ ] **Instance class:** `db.t4g.micro` (~$13/ay on-demand, reserved daha da ucuz)
- [ ] **Storage:** 20 GB gp3, autoscaling kapalı
- [ ] **Multi-AZ:** Hayır (dev için)
- [ ] **VPC:** Default
- [ ] **Public access:** No
- [ ] **VPC security group:** Yeni — `rds-postgres-sg` (inbound kuralını 1.6'da set edeceğiz)
- [ ] **Initial database name:** `paceup`
- [ ] **Backup retention:** 7 gün
- [ ] **Performance Insights:** Kapalı (maliyet)
- [ ] **Deletion protection:** Açık

Oluştuktan sonra endpoint'i not al → `example-shared-db.xxxx.eu-central-1.rds.amazonaws.com:5432`

### 1.3 ECR Repository

- [ ] `paceup-django` repository oluştur (Private, scan on push: on, immutable tags: off başlangıçta)
- [ ] (İleride) `paceup-fastapi` için aynı

```bash
aws ecr create-repository \
  --repository-name paceup-django \
  --region eu-central-1 \
  --image-scanning-configuration scanOnPush=true
```

### 1.4 ECS Cluster

- [ ] Cluster adı: `example-cluster`
- [ ] Infrastructure: **AWS Fargate** (sadece)
- [ ] Container Insights: Kapalı (maliyet, gerekirse sonra aç)

```bash
aws ecs create-cluster --cluster-name example-cluster --region eu-central-1
```

### 1.5 ALB + Target Groups + Listener Rules

- [ ] **Application Load Balancer** oluştur
  - Name: `example-alb`
  - Scheme: Internet-facing
  - IP type: IPv4
  - VPC: default, her iki public subnet'i seç
  - SG: Yeni `alb-sg` — inbound 80 + 443 from 0.0.0.0/0

- [ ] **Target Group — Django**
  - Name: `tg-paceup-django`
  - Protocol: HTTP, Port: 8000
  - Target type: **IP** (Fargate için zorunlu)
  - VPC: default
  - Health check path: `/api/`
  - Healthy threshold: 2, interval: 30s
  - Deregistration delay: 30 sn

- [ ] **(İleride) Target Group — FastAPI**
  - Name: `tg-paceup-fastapi`, Port: 8001, Health check: `/health`

- [ ] **Listener :80** → redirect to HTTPS :443
- [ ] **Listener :443**
  - Default action: return fixed response `404 Not Found`
  - Rule 1: Host header `your-domain.com` AND Path `/api/*` → forward to `tg-paceup-django`
  - Rule 2 (rezerve): Host `your-domain.com` AND Path `/chat-stream` → forward to `tg-paceup-fastapi`

### 1.6 Security Groups Zinciri

| SG | Inbound | Amaç |
|----|---------|------|
| `alb-sg` | 80, 443 from 0.0.0.0/0 | ALB public |
| `ecs-tasks-sg` | 8000 from `alb-sg` | ECS sadece ALB'den trafik alır |
| `rds-postgres-sg` | 5432 from `ecs-tasks-sg` | RDS sadece ECS'den trafik alır |

RDS SG'yi 1.2'de oluşturduktan sonra inbound rule'u buraya göre set et.

### 1.7 ACM SSL Sertifikası

- [ ] **eu-central-1'de** (ALB'nin olduğu region — CloudFront değil!) ACM'de sertifika iste
  - Domain: `your-domain.com`
  - Validation: DNS
- [ ] Route53'te otomatik CNAME ekle butonuna tıkla
- [ ] "Issued" duruma gelince ALB listener :443 → certificate olarak seç

### 1.8 Route53 DNS

- [ ] Hosted zone `example.com` içinde **A record** (alias) oluştur
  - Name: `paceup`
  - Type: A (alias)
  - Alias target: `example-alb-xxxxx.eu-central-1.elb.amazonaws.com`

### 1.9 Secrets Manager

Django env var'larını plaintext yerine Secrets Manager'da tutuyoruz — ECS task definition `secrets` olarak inject eder.

- [ ] Secret: `paceup/django` (key-value)
  ```json
  {
    "DJANGO_SECRET_KEY": "<openssl rand -hex 50>",
    "DATABASE_URL": "postgres://postgres:<master-pass>@example-shared-db.xxxx.eu-central-1.rds.amazonaws.com:5432/paceup",
    "AWS_STORAGE_BUCKET_NAME": "your-s3-bucket-name",
    "GOOGLE_CLIENT_ID": "...",
    "GOOGLE_CLIENT_SECRET": "..."
  }
  ```

> `AWS_ACCESS_KEY_ID`/`SECRET` artık gerekmez — ECS task role'ü S3 yazma izni alır (1.10).

### 1.10 IAM Roles

- [ ] **`ecsTaskExecutionRole`** — AWS managed `AmazonECSTaskExecutionRolePolicy` + Secrets Manager read için ek inline policy:
  ```json
  {
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": "arn:aws:secretsmanager:eu-central-1:<acct>:secret:paceup/*"
  }
  ```

- [ ] **`paceup-django-task-role`** — Django app runtime permission'ı (S3 upload için)
  ```json
  {
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::your-s3-bucket-name/*"
  }
  ```

---

## Faz 2 — İlk Deploy

### 2.1 Docker image build & ECR push

```bash
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-central-1
REPO=paceup-django

# ECR login
aws ecr get-login-password --region $REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build (x86_64 hedefi — Fargate ucuz tarife için)
docker buildx build \
  --platform linux/amd64 \
  -f Dockerfile.django \
  -t $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO:latest \
  --push .
```

> **Önemli:** Mac M-series üzerindeyiz, `--platform linux/amd64` **zorunlu**. Aksi halde ECS task `exec format error` ile patlar.

### 2.2 ECS Task Definition — Django

`ecs/task-definition.django.json` dosyası (repo'da versiyonlanır):

```json
{
  "family": "paceup-django",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::<ACCT>:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::<ACCT>:role/paceup-django-task-role",
  "containerDefinitions": [
    {
      "name": "django",
      "image": "<ACCT>.dkr.ecr.eu-central-1.amazonaws.com/paceup-django:latest",
      "essential": true,
      "portMappings": [{ "containerPort": 8000, "protocol": "tcp" }],
      "environment": [
        { "name": "DJANGO_DEBUG", "value": "False" },
        { "name": "DJANGO_ALLOWED_HOSTS", "value": "your-domain.com" },
        { "name": "DJANGO_CSRF_TRUSTED_ORIGINS", "value": "https://your-domain.com" },
        { "name": "AWS_DEFAULT_REGION", "value": "eu-central-1" }
      ],
      "secrets": [
        { "name": "DJANGO_SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:eu-central-1:<ACCT>:secret:paceup/django:DJANGO_SECRET_KEY::" },
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:eu-central-1:<ACCT>:secret:paceup/django:DATABASE_URL::" },
        { "name": "AWS_STORAGE_BUCKET_NAME", "valueFrom": "arn:aws:secretsmanager:eu-central-1:<ACCT>:secret:paceup/django:AWS_STORAGE_BUCKET_NAME::" },
        { "name": "GOOGLE_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:eu-central-1:<ACCT>:secret:paceup/django:GOOGLE_CLIENT_ID::" },
        { "name": "GOOGLE_CLIENT_SECRET", "valueFrom": "arn:aws:secretsmanager:eu-central-1:<ACCT>:secret:paceup/django:GOOGLE_CLIENT_SECRET::" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/paceup-django",
          "awslogs-region": "eu-central-1",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
```

- [ ] `<ACCT>` değerlerini gerçek account ID ile değiştir
- [ ] Register:
  ```bash
  aws ecs register-task-definition \
    --cli-input-json file://ecs/task-definition.django.json \
    --region eu-central-1
  ```

### 2.3 ECS Service

- [ ] Service oluştur (ilk kez):
  ```bash
  aws ecs create-service \
    --cluster example-cluster \
    --service-name paceup-django-service \
    --task-definition paceup-django \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-ecs-tasks],assignPublicIp=ENABLED}" \
    --load-balancers "targetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/tg-paceup-django/xxx,containerName=django,containerPort=8000" \
    --health-check-grace-period-seconds 60 \
    --region eu-central-1
  ```

### 2.4 Migrations (ilk açılışta)

`entrypoint.sh` her container start'ında `migrate` çalıştırdığı için **ayrı bir migration task'ına gerek yok** — ilk task ayağa kalkarken tablolar oluşur.

> Eğer production'da data-sensitive migration (örn. `RunPython`) çalıştıracaksan, o zaman `aws ecs run-task` ile one-off task tercih edilebilir.

### 2.5 Smoke Test

- [ ] `https://your-domain.com/api/` → `200 OK`
- [ ] `https://your-domain.com/api/users/me/` → `401 Unauthorized` (JWT yok)
- [ ] CloudWatch log group `/ecs/paceup-django` → gunicorn + qcluster çıktıları
- [ ] RDS metrics → CPU düşük, connection sayısı makul
- [ ] İlk superuser: bir kere manual exec ile
  ```bash
  aws ecs execute-command \
    --cluster example-cluster \
    --task <task-id> \
    --container django \
    --interactive \
    --command "python manage.py createsuperuser"
  ```
  > **Not:** Bu komutun çalışması için task definition'da `enableExecuteCommand: true` gerekli + task role'de SSM permission. İstersen admin'e girmeden önce ekleriz.

---

## Faz 3 — CI/CD (GitHub Actions)

> `git push master` → otomatik build + ECS rolling update

Workflow dosyası: `.github/workflows/deploy.yml`

```yaml
name: Deploy Django to ECS

on:
  push:
    branches: [master]
    paths:
      - "apps/**"
      - "paceupbackend/**"
      - "docker/**"
      - "Dockerfile.django"
      - "requirements.txt"
      - ".github/workflows/deploy.yml"

env:
  AWS_REGION: eu-central-1
  ECR_REPO: paceup-django
  ECS_CLUSTER: example-cluster
  ECS_SERVICE: paceup-django-service

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr

      - name: Build & push image
        env:
          REGISTRY: ${{ steps.ecr.outputs.registry }}
          TAG: ${{ github.sha }}
        run: |
          docker buildx build \
            --platform linux/amd64 \
            -f Dockerfile.django \
            -t $REGISTRY/$ECR_REPO:$TAG \
            -t $REGISTRY/$ECR_REPO:latest \
            --push .

      - name: Force ECS rolling deployment
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment \
            --region $AWS_REGION

      - name: Wait for service stability
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE \
            --region $AWS_REGION
```

### GitHub Secrets

| Secret | Açıklama |
|--------|----------|
| `AWS_ACCESS_KEY_ID` | IAM user (programmatic, sadece ECR push + ecs:UpdateService) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |

**Daha güvenli (sonraki iterasyon):** IAM user yerine **GitHub OIDC** — AWS IAM'de `GitHubActionsOIDCRole` oluştur, secret'a gerek kalmaz.

### Gelecek iyileştirmeler

- [ ] Staging/prod ayrımı (`develop` → staging, `master` → prod)
- [ ] Migration adımı — deploy öncesi one-off task (sadece destructive migration'lar için)
- [ ] Slack bildirimi (deploy success/fail)
- [ ] FastAPI service eklendiğinde ikinci job

---

## Troubleshooting

- **Task sürekli `STOPPED`:** CloudWatch logs'a bak. Sebepler genelde: env var eksik, RDS'ye bağlanamıyor (SG), image mimari uyumsuz (`--platform linux/amd64` unutuldu).
- **ALB health check fail:** Target group health path `/api/` olmalı, `/` değil. Django root'ta URL yok.
- **`collectstatic` yavaş:** Build zamanında çalıştırmak isterseniz `Dockerfile.django`'ya `RUN python manage.py collectstatic --noinput` ekleyebilirsiniz (env var'lar build'de yoksa dummy'lerle çalıştırmak gerek). Şu an runtime'da (`entrypoint.sh`'de).
- **qcluster bellek şişirmesi:** `recycle: 500` zaten set, worker'lar 500 task sonrası yeniden doğuyor.
