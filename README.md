# PaceUp 🏃

> A chatbot-powered running planner. Chat with an AI coach to generate
> personalized training programs, laid out on an in-app calendar.

PaceUp helps runners train smarter. Instead of filling out forms, you simply
**talk to an AI coach** about your goals, fitness level and schedule — and it
builds a structured training program for you. Each program is broken down into
typed workouts (Easy, Long, Tempo, Interval) and placed on a calendar so you
always know what today's session looks like.

## Features

- 🤖 **AI coach chat** — describe your goal in natural language; the assistant
  generates a tailored running program.
- 📅 **Calendar-based plans** — generated workouts appear on an in-app calendar,
  day by day.
- 🏃 **Typed workouts** — Easy / Long / Tempo / Interval sessions, each with its
  own pace and distance targets.
- 📊 **Stats chat** — ask the chatbot about your own statistics: how many
  workouts you've created, your progress, and more.
- 🔔 **Reminders** — get a notification the day before each scheduled workout so
  you never miss a session.
- 🔐 **Auth** — email/password, Google Sign-In and Sign in with Apple.

## Architecture

PaceUp is a monorepo of three services:

```
paceup/
├── backend/   — Django REST API: auth, programs, activity, stats, notifications
├── mobile/    — Expo / React Native (TypeScript) app — the user-facing client
└── chatapi/   — FastAPI + LangGraph service: the AI coach that generates plans
```

How they talk to each other:

```
                 ┌─────────────┐
                 │   mobile    │  (Expo / React Native)
                 └──────┬──────┘
            REST API    │    SSE chat stream
          ┌─────────────┴──────────────┐
          ▼                            ▼
   ┌─────────────┐  shared JWT  ┌─────────────┐
   │  backend    │◄────secret──►│   chatapi   │
   │  (Django)   │              │  (FastAPI)  │
   └──────┬──────┘              └──────┬──────┘
          │      shared Postgres       │
          └────────────┬───────────────┘
                       ▼
                  ┌─────────┐
                  │ Postgres│
                  └─────────┘
```

- **mobile** calls **backend** over REST and streams chat from **chatapi** (SSE).
- **chatapi** verifies the user's JWT using the **same** `DJANGO_SECRET_KEY` as
  the backend (HS256), and reads/writes the **same** Postgres database.
- **chatapi** uses LangGraph + AWS Bedrock to generate the training plans.

## Tech stack

| Service   | Stack |
|-----------|-------|
| `backend` | Python 3.12 · Django 6 · Django REST Framework · SimpleJWT · PostgreSQL · S3 (django-storages) · django-q2 |
| `mobile`  | TypeScript · Expo · React Native · Expo Router · RevenueCat |
| `chatapi` | Python 3.12 · FastAPI · LangGraph · LangChain · AWS Bedrock · SSE |

## Getting started

Each service has its own `.env.example` — copy it to `.env` and fill in your
values before running.

### backend (`backend/`)

```bash
cp .env.example .env           # then fill in secrets
docker compose up -d --build   # Postgres + Django
# — or run locally —
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
Runs on `http://localhost:8000` · API mounted under `/api`.

### chatapi (`chatapi/`)

```bash
cp .env.example .env           # DJANGO_SECRET_KEY must match the backend
docker compose up -d --build
# — or run locally —
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```
Runs on `http://localhost:8001` · `GET /health`, `POST /chat-stream` (SSE).

### mobile (`mobile/`)

```bash
cp .env.example .env           # EXPO_PUBLIC_* values
npm install
npm start                      # Expo dev server
npm run ios                    # build to a connected iOS device
USE_PROD_API=1 npm start       # dev build pointed at the production backend
```

## Configuration & secrets

No project-specific values are hardcoded in the source. Everything is read from
environment variables:

- **backend / chatapi** read from `.env` via `os.getenv`.
- **mobile** reads `EXPO_PUBLIC_*` vars (Expo inlines them at build time).

Each service ships a committed `.env.example` with placeholders; the real
`.env` files are gitignored and never committed.

## License

Released under the [MIT License](LICENSE) © 2026 Berkan Türkoğlu.
