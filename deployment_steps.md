# PaceUp Deployment Yol Haritası

## Mimari

```
                    ┌──────────────┐
                    │   Route 53   │  (Domain DNS)
                    └──────┬───────┘
                           │
                    ┌──────▼──────┐
                    │     ALB     │  (Shared — tüm app'ler)
                    └──┬──────┬───┘
                       │      │
              ┌────────▼┐  ┌──▼────────┐
              │ ECS Task│  │ ECS Task  │
              │ Django  │  │ FastAPI   │
              │ :8000   │  │ :8001     │
              └────┬────┘  └─────┬─────┘
                   │             │
              ┌────▼─────────────▼────┐
              │    RDS PostgreSQL     │  (Shared — tüm app'ler)
              │    (db.t4g.micro)     │
              └───────────────────────┘
```

### Maliyet Tahmini

| Bileşen | Maliyet | Paylaşımlı? |
|---------|---------|-------------|
| ALB | ~$16/ay | Tüm app'ler |
| RDS db.t4g.micro | ~$13/ay | Tüm app'ler |
| ECS Task (Django) | ~$9/ay | PaceUp |
| ECS Task (FastAPI) | ~$9/ay | PaceUp |
| **PaceUp toplam** | **~$47/ay** | |
| **Sonraki her app** | **+$9/ay** | Sadece task maliyeti |

---

## Faz 0 — Kod Hazırlığı (Lokalde)

> Henüz AWS'ye dokunmuyoruz, kodu production-ready yapıyoruz

- [ ] 1. `requirements.txt` oluştur (backend + graph-api)
- [ ] 2. Django `settings.py` production ayarları — `DEBUG`, `SECRET_KEY`, `DATABASES` env'den oku
- [ ] 3. Dockerfile yaz — Django ve FastAPI için ayrı ayrı
- [ ] 4. `docker-compose.yml` yaz — lokalde test etmek için (Django + FastAPI + PostgreSQL)
- [ ] 5. Lokalde test — `docker-compose up` ile her şey çalışıyor mu?

---

## Faz 1 — AWS Altyapısı (Tek seferlik kurulum)

> Shared infra — tüm app'lerin kullanacağı temel

- [ ] 6. **VPC** — Default VPC kullan veya yeni oluştur (public + private subnet)
- [ ] 7. **RDS PostgreSQL** — `db.t4g.micro`, private subnet'te, Single-AZ
- [ ] 8. **ECR** — 2 repository oluştur (`paceup-django`, `paceup-fastapi`)
- [ ] 9. **ECS Cluster** — Fargate cluster oluştur (sadece bir isim, maliyet yok)
- [ ] 10. **ALB + Target Groups** — HTTPS termination, path-based routing
  - `/api/*` → Django target group
  - `/chat-stream` → FastAPI target group
- [ ] 11. **Security Groups** — ALB → ECS → RDS zinciri
  - ALB SG: 80, 443 inbound from anywhere
  - ECS SG: 8000, 8001 inbound from ALB SG only
  - RDS SG: 5432 inbound from ECS SG only
- [ ] 12. **Route 53 + ACM** — Domain + SSL sertifikası

---

## Faz 2 — Deploy (İlk Yayın)

> Container'ları push et, task'ları çalıştır

- [ ] 13. Docker image build & ECR push
  ```bash
  aws ecr get-login-password --region eu-central-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-central-1.amazonaws.com
  docker build -t paceup-django -f Dockerfile.django .
  docker tag paceup-django:latest <account-id>.dkr.ecr.eu-central-1.amazonaws.com/paceup-django:latest
  docker push <account-id>.dkr.ecr.eu-central-1.amazonaws.com/paceup-django:latest
  ```
- [ ] 14. **ECS Task Definition** — CPU, RAM, env vars, container port
  - Django: 256 CPU, 512 MEM, port 8000
  - FastAPI: 256 CPU, 512 MEM, port 8001
  - Env vars: DB host, DB password, SECRET_KEY, AWS keys, Google credentials
- [ ] 15. **ECS Service** — Task'ı çalıştır, ALB'ye bağla
- [ ] 16. **Django migrate** — One-off ECS task ile migration çalıştır
  ```bash
  aws ecs run-task --cluster paceup-cluster --task-definition paceup-django --overrides '{"containerOverrides":[{"name":"django","command":["python","manage.py","migrate"]}]}'
  ```
- [ ] 17. **Smoke test** — `https://api.paceup.com/api/users/me/` çalışıyor mu?

---

## Faz 3 — CI/CD (GitHub Actions)

> `git push main` → otomatik deploy

### Workflow: `.github/workflows/deploy.yml`

```yaml
name: Deploy to ECS

on:
  push:
    branches: [main]

env:
  AWS_REGION: eu-central-1
  ECR_REPO_DJANGO: paceup-django
  ECR_REPO_FASTAPI: paceup-fastapi
  ECS_CLUSTER: paceup-cluster
  ECS_SERVICE_DJANGO: paceup-django-service
  ECS_SERVICE_FASTAPI: paceup-fastapi-service

jobs:
  deploy-django:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr-login

      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPO_DJANGO:$IMAGE_TAG -f Dockerfile.django .
          docker build -t $ECR_REGISTRY/$ECR_REPO_DJANGO:latest -f Dockerfile.django .
          docker push $ECR_REGISTRY/$ECR_REPO_DJANGO:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPO_DJANGO:latest

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_DJANGO \
            --force-new-deployment

  deploy-fastapi:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr-login

      - name: Build and push
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPO_FASTAPI:$IMAGE_TAG -f Dockerfile.fastapi .
          docker build -t $ECR_REGISTRY/$ECR_REPO_FASTAPI:latest -f Dockerfile.fastapi .
          docker push $ECR_REGISTRY/$ECR_REPO_FASTAPI:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPO_FASTAPI:latest

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE_FASTAPI \
            --force-new-deployment
```

### GitHub Secrets (repo Settings → Secrets → Actions)

| Secret | Açıklama |
|--------|----------|
| `AWS_ACCESS_KEY_ID` | IAM user (programmatic access) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |

### İleride Eklenebilecekler

- **Path filter** — sadece backend kodu değişince deploy (`paths: ['apps/**']`)
- **Staging/Prod ayrımı** — `develop` → staging, `main` → production
- **Migration step** — deploy öncesi `aws ecs run-task` ile one-off migration
- **Slack notification** — deploy başarılı/başarısız bildirimi
- **OIDC** — IAM user yerine GitHub OIDC provider (secret key yok, daha güvenli)
