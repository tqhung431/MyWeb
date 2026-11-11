# Nook

**A cozy corner of the web for your free time**, which you run yourself on your own PC and share with
everyone on your network (family, roommates, classmates).

- 🌙 **Chill Corner**: a focus timer with your own focus and break lengths, 11 relaxing sounds you can mix,
  your weekly focus chart, achievements, and focus tips.
- 🎵 **Music**: songs with vocals that Nook stores and plays itself, so they play on any network (no YouTube or
  SoundCloud to be blocked). Drag in your songs: the title, artist, cover and genre are read for you.
  Top songs of the week and month, with a starter pack of 12 Creative Commons songs.
- ✨ **Free-time Companion**: an AI buddy that suggests songs and tips from Nook, in English or Vietnamese.
  It runs **on your PC** (Ollama), so your chats never leave your network. Optional.
- 👥 **Together, live**: see who's online and what others are doing, as it happens. Use it as a guest right away,
  or create an account to keep your history on every device.
- 🌗 Light and dark themes, works on phones and desktops.

It's also my **web programming learning project for 2026**: it grows one stage at a time, from a single
HTML page to a full system. Every stage has an explainer in [docs/](#stages).

---

## Install from scratch

You need two free programs:

| Program | Why | Get it |
|---|---|---|
| **Git** | to download Nook and its updates | https://git-scm.com/downloads |
| **Docker Desktop** | runs every part of Nook in "containers", so you don't install them one by one | https://www.docker.com/products/docker-desktop |

On Windows, Docker Desktop asks to turn on **WSL 2**: say yes and restart. Then open Docker Desktop once and
wait until it says it's running.

Then, in a terminal (on Windows: PowerShell):

```bash
git clone https://github.com/tqhung431/Nook.git
cd Nook
git checkout claude/zealous-hopper-b0w8ms   # the branch with the latest stage (skip once it's merged into main)

cp .env.example .env                        # Windows PowerShell: copy .env.example .env
# Open .env in a text editor and set POSTGRES_PASSWORD (do this before the first start).

docker compose --profile app up -d --build  # the first time takes 5-10 minutes
```

Then open:

- **https://localhost** on this PC. The first time, your browser warns about the certificate. That's expected:
  see [docs/stage-7.md](docs/stage-7.md) to trust it, or click "Advanced → Continue".
- **http://&lt;this PC's IP&gt;** from other PCs and phones on the same Wi-Fi (find the IP with `ipconfig` on
  Windows, `ip addr` on Linux). If they can't connect, allow port 80 in this PC's firewall.

### Optional extras

Add a profile to the start command to turn an extra on:

| Extra | Start command | Notes |
|---|---|---|
| **AI Companion** | `docker compose --profile app --profile ai up -d` | Downloads Ollama and the models once (a few GB). On a low-end PC, set `AI_CHAT_MODEL=qwen2.5:0.5b` in `.env` first. Watch the download: `docker compose logs -f ollama-models` |
| **Grafana** (monitoring) | `docker compose --profile app --profile monitoring up -d` | First remove the `#` from the 3 monitoring lines in `.env`. Open http://localhost:3001. Needs ~1-2 GB of RAM |
| Both | `docker compose --profile app --profile ai --profile monitoring up -d` | Needs a PC with 8 GB+ of RAM |

All settings are explained in [.env.example](.env.example).

---

## Upgrade to the latest version

Your data (accounts, songs, history, AI models) is kept in Docker volumes and **survives upgrades**.

```bash
cd Nook
git pull                                       # get the new code
docker compose --profile app up -d --build     # rebuild and restart (add the same --profile ai / monitoring you use)
```

The database is updated automatically when the API starts (migrations), so there's nothing else to run.
Read `.env.example` after an upgrade: new settings may have been added. Copy the ones you want into your `.env`.

To also update the images Nook builds on (PostgreSQL, Caddy, Ollama...):

```bash
docker compose --profile app --profile ai pull
docker compose --profile app --profile ai up -d --build
```

## Everyday commands

```bash
docker compose ps                                     # what's running
docker compose logs -f api                            # follow one service's logs (api, worker, web, caddy, ollama...)
docker compose --profile app --profile ai --profile monitoring down   # stop everything (data is kept)
docker compose --profile app --profile ai --profile monitoring down -v  # ⚠️ stop AND delete all data
docker builder prune -f && docker image prune -f      # free disk space taken by old builds
```

## What runs, and why

```
                ┌──────────────────────────── docker compose ─────────────────────────────┐
Browsers ──► caddy ──► web (Next.js) ──► api (+ live updates) ──► db (PostgreSQL + pgvector)
 (:80, :443)    └── /api/* ─────────────►  │  worker ───────────► valkey · mailpit
                                           └──► ollama (AI, profile "ai")
                every service ── traces + metrics ──► otel-lgtm / Grafana (profile "monitoring")
```

| Service | Needed? | What it does |
|---|---|---|
| **caddy** | yes | The front door: HTTPS, lets other PCs in, sends `/api` to the API and pages to the website |
| **web** | yes | The website (Next.js + React) |
| **api** | yes | The data and the rules: accounts, timer history, songs, charts, live updates, the AI chat |
| **worker** | yes | Background jobs: welcome emails, achievements, preparing songs and tips for the AI |
| **db** | yes | PostgreSQL: where everything is stored; pgvector lets the AI search by meaning |
| **valkey** | yes | Fast memory store: cache, rate limits, the job queue, live updates across services |
| **mailpit** | dev | Catches emails so you can read them at http://localhost:8025 |
| **ollama** | AI only | Runs the AI models on your PC |
| **ollama-models** | AI only | Downloads the models, then stops (showing "Exited" is normal) |
| **otel-lgtm** | monitoring only | Grafana with traces, metrics and logs of every request |

---

## For developers

Run each part yourself, with live reload. Needs Node.js 20.9+; Docker provides PostgreSQL, Valkey and Mailpit.

```bash
docker compose up -d                          # 1. PostgreSQL + Valkey + Mailpit only

cd api && cp .env.example .env && npm install # 2. API
npm run db:migrate && npm run db:seed
npm run dev                                   #    http://localhost:4000/health
npm run worker                                #    background jobs (new terminal)

cd web && npm install && npm run dev          # 3. website (new terminal)
                                              #    http://localhost:3000
```

Tests: `npm test` in `api/` and in `web/`. GitHub Actions runs them, plus a full Docker start, on every push.
For the AI, install [Ollama](https://ollama.com), pull the two models, and set `OLLAMA_URL` in `api/.env`
(see [docs/stage-9.md](docs/stage-9.md)).

### Folders

```
web/                   the website (Next.js, React, TypeScript, Tailwind)
  app/                 pages (folders = URLs)
  features/            each app's parts: focus, ambient, music, companion, auth, realtime...
  components/          the design system (ui/) and the app shell (shell/)
  lib/apps.ts          the app registry: add a new app here
  lib/api/             talking to the API
api/                   the API and the worker (Express, TypeScript)
  src/routes/          the /api/* endpoints
  src/ai/              the AI Companion: Ollama, embeddings, search
  src/jobs/            background jobs
  src/realtime/        live updates (Socket.IO)
  src/db/, drizzle/    database schema and migrations
docs/                  one explainer per stage
docker-compose.yml     every service, with the "app", "ai" and "monitoring" profiles
Caddyfile              the front door's settings
.github/workflows/     automatic checks on every push
monitoring/            a Grafana dashboard to import
music-import/          drop song files here to import many at once
stage-1-static/        Stage 1: the plain HTML/CSS/JS version
```

## Stages

1. Static page — Chill Corner ✅ · [docs](docs/stage-1.md)
2. Frontend app — Next.js, React, TypeScript ✅ · [docs](docs/stage-2.md)
3. API + database — Express, PostgreSQL ✅ · [docs](docs/stage-3.md)
   - 3.5 Frontend review, app shell, design system ✅ · [docs](docs/stage-3.5.md)
4. Many users — guests first, optional accounts, other PCs ✅ · [docs](docs/stage-4.md)
5. Cache, queue, worker — Valkey; themes and sound mixer ✅ · [docs](docs/stage-5.md)
6. Real-time — Socket.IO, who's online, live feed ✅ · [docs](docs/stage-6.md)
7. Packaging — Docker Compose, Caddy; Music app ✅ · [docs](docs/stage-7.md)
8. Automation and monitoring — GitHub Actions, OpenTelemetry, Grafana ✅ · [docs](docs/stage-8.md)
9. Local AI — Ollama, embeddings in pgvector, streamed answers ✅ · [docs](docs/stage-9.md)

Nook was called **MyWeb** until Stage 9. Credits and licences: [CREDITS.md](CREDITS.md)
