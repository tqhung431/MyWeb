# MyWeb

My web programming learning project for 2026. It grows one stage at a time,
from a static page to a full system (frontend, API, database, real-time, AI).

## Current: Stage 8 — automated checks and monitoring

MyWeb is a hub of small apps with a sidebar (desktop), a tab bar (phone) and a floating mini player.
**Chill Corner**: a focus timer with your own lengths, 11 generated sounds, a weekly chart, achievements and tips.
**Music**: songs with vocals that **MyWeb stores and plays itself** (works behind any firewall), genre detected automatically,
a starter pack of 12 Creative Commons songs, and top week / month charts. Several people can use it at once, live.
Every push is **tested on GitHub Actions**; **Grafana** shows traces and metrics across all services.

```
              ┌──────────── docker compose ───────────────────────────────────┐
Browsers ──► Caddy (:80, :443) ──► web (Next.js) ──► api (+ Socket.IO) ──► db (PostgreSQL)
              /api/* + WebSockets ─────────────────►  │      worker ─────► valkey · mailpit
              └─────────── traces + metrics ──► otel-lgtm (Grafana :3001, profile "monitoring")
```

**Start everything:** `cp .env.example .env && docker compose --profile app up -d --build`, then open
**https://localhost** (or **http://&lt;this PC's IP&gt;** from other PCs).

- CI, OpenTelemetry, Grafana, and the rebuilt Music: [docs/stage-8.md](docs/stage-8.md)
- Docker, Caddy, Music and the adjustable timer: [docs/stage-7.md](docs/stage-7.md)
- Real-time, presence, live feed, Vietnamese drill: [docs/stage-6.md](docs/stage-6.md)
- Cache, job queue, worker, theme and sound mixer: [docs/stage-5.md](docs/stage-5.md)
- Using MyWeb from other PCs, guests and accounts: [docs/stage-4.md](docs/stage-4.md)
- Frontend review, structure and how to add a new app: [docs/stage-3.5.md](docs/stage-3.5.md)
- API, request flows, schema: [docs/stage-3.md](docs/stage-3.md)
- Earlier stages: [Stage 1](docs/stage-1.md) · [Stage 2](docs/stage-2.md)
- Credits and licences: [CREDITS.md](CREDITS.md)

### Run it

Needs Node.js 20.9+ and PostgreSQL 16 (easiest: Docker).

```bash
docker compose up -d                          # 1. PostgreSQL + Valkey + Mailpit

cd api && cp .env.example .env && npm install # 2. API
npm run db:migrate && npm run db:seed
npm run dev                                   #    http://localhost:4000/health
npm run worker                                #    background jobs (new terminal)

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
  src/jobs/, worker.ts job queue and the background worker
  src/valkey/          cache and Valkey connection
  src/realtime/        Socket.IO server and live events
  src/db/              schema, migrations runner, seed data
  drizzle/             generated SQL migrations
  tests/               API tests (Vitest + Supertest)
stage-1-static/        Stage 1: the plain HTML/CSS/JS version
docs/                  one explainer per stage
docker-compose.yml     everything (profile "app") or just PostgreSQL, Valkey, Mailpit
Caddyfile              the front door: HTTPS, routing, WebSockets, real IPs, tracing
.github/workflows/     CI: tests, builds and a Docker smoke test on every push
monitoring/            Grafana dashboard to import
music-import/          drop song files here to import them
```

## Stages

1. Static page — **Chill Corner** ✅
2. Frontend app — Next.js + React + TypeScript ✅
3. API + database — Node API + PostgreSQL ✅
   - 3.5 Frontend review, app shell, design system ✅
4. Many users — guests first, optional accounts, network access ✅
5. Cache + queue + worker — Valkey ✅
6. Real-time — Socket.IO, presence, live feed ✅
7. Packaging — Docker Compose + Caddy ✅ (+ Music app, custom timer lengths)
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana ✅ (+ Music stores its own files)
9. Local AI (optional) — Ollama
