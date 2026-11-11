# MyWeb

My web programming learning project for 2026. It grows one stage at a time,
from a static page to a full system (frontend, API, database, real-time, AI).

## Current: Stage 2 — Chill Corner in Next.js

A calm app with ambient sounds (rain, waves, lo-fi keys), a focus timer and focus tips,
built with **Next.js 16, React 19 and TypeScript**.

- How it works, request flow and diagrams: [docs/stage-2.md](docs/stage-2.md)
- Stage 1 (plain HTML/CSS/JS) explained: [docs/stage-1.md](docs/stage-1.md)
- Credits and licences: [CREDITS.md](CREDITS.md)

### Run it

Needs Node.js 20.9 or newer.

```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

### Folders

```
web/                   Stage 2: the Next.js app
  app/                 pages and layout (folders = URLs)
  components/          React components (SoundPlayer, FocusTimer, Nav, ...)
  hooks/               useTimer, useDailyCount
  lib/                 ambient.ts (Web Audio), tips.ts (data)
stage-1-static/        Stage 1: the plain HTML/CSS/JS version (open index.html)
docs/                  one explainer per stage
```

## Stages

1. Static page — **Chill Corner** ✅
2. Frontend app — Next.js + React + TypeScript ✅
3. API + database — Node API + PostgreSQL
4. Login — sessions and OAuth
5. Cache + queue + worker — Valkey
6. Real-time — WebSockets
7. Packaging — Docker Compose + Caddy
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana
9. Local AI (optional) — Ollama
