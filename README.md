# MyWeb

My web programming learning project for 2026. It grows one stage at a time,
from a static page to a full system (frontend, API, database, real-time, AI).

## Stage 1: Chill Corner (current)

A calm page with ambient sounds (rain, waves, lo-fi keys) and a focus timer.
Plain HTML, CSS and JavaScript only.

- How it works and the request flow: [docs/stage-1.md](docs/stage-1.md)
- Credits and licences: [CREDITS.md](CREDITS.md)

### Run it

Option 1: double-click `index.html` to open it in your browser.

Option 2 (closer to a real website), run a small local server:

```bash
npx serve .
# then open http://localhost:3000
```

### Files

```
index.html     the main page (content)
about.html     about + credits page
css/style.css  layout and theme (mobile-first)
js/audio.js    ambient sounds made with the Web Audio API
js/timer.js    countdown timer logic (no DOM code)
js/app.js      connects buttons on the page to the sound and timer code
```

## Stages

1. Static page — **Chill Corner** ✅
2. Frontend app — Next.js + React + TypeScript
3. API + database — Node API + PostgreSQL
4. Login — sessions and OAuth
5. Cache + queue + worker — Valkey
6. Real-time — WebSockets
7. Packaging — Docker Compose + Caddy
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana
9. Local AI (optional) — Ollama
