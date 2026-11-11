# MyWeb

My web programming learning project for 2026. It grows one stage at a time,
from a static page to a full system (frontend, API, database, real-time, AI).

## Current: Stage 4 — many users, guests first

MyWeb is a hub of small apps with a sidebar (desktop), a tab bar (phone) and a floating mini player.
**Chill Corner** (ambient sounds, focus timer, weekly chart, tips) is the first live app.
**Several people can use it at once from other PCs on your network**, each as a guest with their own history.
An account (email + password) is optional and makes your history follow you to any device.

```
Browser ──► Next.js web (:3000) ──► API (:4000) ──► PostgreSQL (:5432)
            pages + /api/* proxy      auth, data
```

- Using MyWeb from other PCs, guests and accounts: [docs/stage-4.md](docs/stage-4.md)
- Frontend review, structure and how to add a new app: [docs/stage-3.5.md](docs/stage-3.5.md)
- API, request flows, schema: [docs/stage-3.md](docs/stage-3.md)
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
                                              #    other PCs: http://<this PC's IP>:3000
```

### Folders

```
web/                   Next.js website (React + TypeScript + Tailwind)
  app/                 routes only (folders = URLs): /, /chill, /chill/tips, /about
  features/            ambient (sounds), focus (timer, stats), tips
  components/ui/       design system: Button, Card, Badge, ...
  components/shell/    sidebar, tab bar, mini player, app header
  lib/apps.ts          app registry: add an app here
  lib/api/             API client
  tests/               frontend tests (Vitest + Testing Library)
api/                   Express API (TypeScript)
  src/routes/          /api/auth, /api/tips, /api/sessions
  src/auth/            password hashing, login sessions
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
   - 3.5 Frontend review, app shell, design system ✅
4. Many users — guests first, optional accounts, network access ✅
5. Cache + queue + worker — Valkey
6. Real-time — WebSockets
7. Packaging — Docker Compose + Caddy
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana
9. Local AI (optional) — Ollama
