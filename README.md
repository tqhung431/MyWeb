# MyWeb

My web programming learning project for 2026. It grows one stage at a time,
from a static page to a full system (frontend, API, database, real-time, AI).

## Current: Stage 3 — Chill Corner with an API and a database

Ambient sounds, a focus timer and focus tips. Focus sessions and tips are now stored in
**PostgreSQL**, behind a **Node.js + Express** API.

```
Browser ──► Next.js web (:3000) ──► API (:4000) ──► PostgreSQL (:5432)
   └──────────── fetch ────────────────┘
```

- How it works, request flows, schema: [docs/stage-3.md](docs/stage-3.md)
- Earlier stages: [Stage 1](docs/stage-1.md) · [Stage 2](docs/stage-2.md)
- Credits and licences: [CREDITS.md](CREDITS.md)

### Run it

Needs Node.js 20.9+ and PostgreSQL 16 (easiest: Docker).

```bash
docker compose up -d db                       # 1. database

cd api && cp .env.example .env && npm install # 2. API
npm run db:migrate && npm run db:seed
npm run dev                                   #    http://localhost:4000/health

cd web && npm install && npm run dev          # 3. website (new terminal)
                                              #    http://localhost:3000
```

### Folders

```
web/                   Next.js website (React + TypeScript)
  app/                 pages and layout (folders = URLs)
  components/          SoundPlayer, FocusTimer, Nav, ChillProvider, ...
  hooks/               useTimer, useSessions
  lib/                 ambient.ts (Web Audio), api.ts (calls the API)
api/                   Express API (TypeScript)
  src/routes/          /api/tips, /api/sessions
  src/db/              schema, migrations runner, seed data
  drizzle/             generated SQL migrations
  tests/               API tests (Vitest + Supertest)
stage-1-static/        Stage 1: the plain HTML/CSS/JS version
docs/                  one explainer per stage
docker-compose.yml     PostgreSQL for local development
```

## Stages

1. Static page — **Chill Corner** ✅
2. Frontend app — Next.js + React + TypeScript ✅
3. API + database — Node API + PostgreSQL ✅
4. Login — sessions and OAuth
5. Cache + queue + worker — Valkey
6. Real-time — WebSockets
7. Packaging — Docker Compose + Caddy
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana
9. Local AI (optional) — Ollama
