# Nook

**A cozy corner of the web for your free time**, which you run yourself on your own PC and share with
everyone on your network (family, roommates, classmates).

- 🌙 **Chill Corner**: a focus timer with your own focus and break lengths, 11 relaxing sounds you can mix,
  your weekly focus chart, achievements, and focus tips.
- 🎵 **Music**: songs with vocals that Nook stores and plays itself, so they play on any network (no YouTube or
  SoundCloud to be blocked). Drag in your songs: the title, artist, cover and genre are read for you.
  Top songs of the week and month, with a starter pack of 12 Creative Commons songs.
  Shuffle, repeat, volume and an "up next" queue.
- 🎮 **Mini Arcade**: six silly games (Hungry Worm, Silly Pairs, Bonk-a-Blob, Pancake Tower, Too Early!,
  Odd Emoji Out) with high scores and live leaderboards for everyone on your Nook.
- ✨ **Free-time Companion**: an AI buddy that suggests songs and tips from Nook, in English or Vietnamese.
  It runs **on your PC** (Ollama), so your chats never leave your network. Optional.
- 🎉 **Arcade Online**: Quiz Party, a live quiz for up to 8 people on Nook. The server runs the game, so
  nobody can cheat; a leaderboard of wins.
- 📺 **WatchList**: search TV shows and anime (TVmaze and MyAnimeList, free), keep your list with stars and
  notes, and see what everyone on Nook is watching.
- ✅ **Habit & Reading Tracker**: daily habits with streaks and reminders, books with pages read, charts,
  and it keeps working offline on your phone.
- 💬 **Hobby Hub**: groups for what you love (Gaming, Cooking, Books…, or start your own), each with posts,
  comments, likes and a live chat.
- 👥 **Together, live**: see who's online and what others are doing, as it happens. No sign-up: you just
  pick a name, so everyone knows who's who. Nook keeps data only for a while (90 days of not using it).
- 🌗 Light and dark themes, works on phones and desktops.

It's also my **web programming learning project for 2026**: it grows one stage at a time, from a single
HTML page to a full system. Every stage has an explainer in [docs/](#stages).

---

## Contents

[Install](#install-from-scratch) · [Settings](#settings-the-env-file) · [Extras: AI and Grafana](#optional-extras-ai-and-grafana) ·
[Upgrade](#upgrade-to-the-latest-version) · [Stop and clean up](#stop-and-clean-up) · [Problems?](#problems) ·
[What runs, and why](#what-runs-and-why) · [Coming from MyWeb](#coming-from-myweb) · [For developers](#for-developers) · [Stages](#stages)

## Install from scratch

You need two free programs:

| Program | Why | Get it |
|---|---|---|
| **Git** | to download Nook and its updates | https://git-scm.com/downloads |
| **Docker Desktop** | runs every part of Nook in "containers", so you don't install them one by one | https://www.docker.com/products/docker-desktop |

On Windows, Docker Desktop asks to turn on **WSL 2**: say yes and restart. Then open Docker Desktop and
wait until it says it's running.

Download Nook (in a terminal; on Windows: PowerShell):

```bash
git clone https://github.com/tqhung431/Nook.git
```

Then start it, **1-click**:

- **Windows**: double-click **`start.cmd`** in the `Nook` folder.
- **macOS / Linux**: run `./start.sh` in the `Nook` folder.

The first start takes 5-10 minutes. The script creates your settings file (`.env`) if you don't have one,
starts everything, and (on Windows) opens **https://localhost**. Prefer typing? These do the same thing:

```bash
cd Nook
cp .env.example .env          # Windows PowerShell: copy .env.example .env
docker compose up -d --build
```

Then open:

- **https://localhost** on this PC. The first time, the browser warns about the certificate. That's expected:
  click "Advanced → Continue", or trust it for good (see [docs/stage-7.md](docs/stage-7.md)).
- **http://&lt;this PC's IP&gt;** from other PCs and phones on the same Wi-Fi (find the IP with `ipconfig` on
  Windows, `ip addr` on Linux). If they can't connect, allow port 80 in this PC's firewall.

## Settings: the .env file

There is **one** settings file for Docker: **`.env` in the main `Nook` folder**, next to `docker-compose.yml`.
Docker reads it and passes the settings on to every part (API, worker, website...).
You don't need to copy anything into `api/` or `web/`: their `.env.example` files are only for
[developers](#for-developers).

```
Nook/
├── .env.example     ← the template, with every setting explained
├── .env             ← YOUR settings (made by start.cmd / start.sh, or copy it yourself)
├── start.cmd        ← 1-click start (Windows)
├── start.sh         ← 1-click start (macOS / Linux)
└── docker-compose.yml
```

After changing `.env`, run `docker compose up -d` (or the start script) again to apply it.

> ⚠️ **Set `POSTGRES_PASSWORD` before the very first start.** The database keeps the first password it was
> started with. If you change it later, the API can't log in ("password authentication failed" in
> `docker compose logs api`): put the old password back, or [start over](#stop-and-clean-up).

## Optional extras: AI and Grafana

Turn extras on with **`COMPOSE_PROFILES`** in `.env`, then run `docker compose up -d` again:

| `COMPOSE_PROFILES=` | What you get | Notes |
|---|---|---|
| `app` | Nook (the default) | |
| `app,ai` | + the **AI Companion** | Downloads Ollama and the models once (a few GB). On a low-end PC, also set `AI_CHAT_MODEL=qwen2.5:0.5b`. Watch the download: `docker compose logs -f ollama-models` |
| `app,monitoring` | + **Grafana** at http://localhost:3001 | Also remove the `#` from the 3 monitoring lines in `.env`. Needs ~1-2 GB of RAM |
| `app,ai,monitoring` | everything | Needs 8 GB+ of RAM |

## Upgrade to the latest version

Your data (people, songs, history, posts, AI models) is kept in Docker volumes and **survives upgrades**.

> **Upgrading to Stage 11 (names only):** sign-in with email and password is gone. Everyone who had an account
> keeps their name and history, and stays signed in on the browser they used. Emails and passwords are deleted
> from the database. Mailpit isn't needed any more: run `docker compose up -d --remove-orphans` once to remove it.

```bash
cd Nook
git pull                      # get the new code
docker compose up -d --build  # rebuild and restart (or run the start script)
```

- The database is updated automatically when the API starts, so there's nothing else to run.
- New settings may have been added: compare your `.env` with `.env.example` and copy what you want.
- To also update the programs Nook builds on (PostgreSQL, Caddy, Ollama...): `docker compose pull`, then `docker compose up -d --build`.

## Stop and clean up

| What | Command | Your data |
|---|---|---|
| See what's running | `docker compose ps` | |
| Stop Nook | `docker compose down` | ✅ kept |
| Start it again | `docker compose up -d` (or the start script) | ✅ kept |
| Free disk space from old builds | `docker builder prune -f` and `docker image prune -f` | ✅ kept |
| Delete only the AI models (they download again when needed) | `docker volume rm nook_ollama-models` | ✅ rest kept |
| **Start over**: delete all data | `docker compose down -v` | ❌ **everything deleted**: people, songs, history, posts, AI models |
| Also delete Nook's images | `docker compose down -v --rmi local` | ❌ everything deleted |
| Remove Nook completely | the command above, then delete the `Nook` folder | ❌ |

`down` only stops the parts in your `COMPOSE_PROFILES`. If you removed `ai` or `monitoring` from it while they
were running, stop them with `docker compose --profile ai --profile monitoring down`.

## Problems?

| You see | Do this |
|---|---|
| `docker compose logs api` says **password authentication failed** | The database was first started with another `POSTGRES_PASSWORD`. Put that one back in `.env` (the default is `nook`), or start over with `docker compose down -v`. Coming from MyWeb? [See below](#coming-from-myweb) |
| **Port 80 / 443 is already in use** | Set `HTTP_PORT=8080` (and `HTTPS_PORT=8443`) in `.env`, then open http://localhost:8080 |
| **Grafana** (localhost:3001) doesn't open | Add `monitoring` to `COMPOSE_PROFILES`, run `docker compose up -d`, wait a minute. Still nothing: `docker compose logs otel-lgtm` |
| The **Companion** says it's off or downloading | Add `ai` to `COMPOSE_PROFILES`, run `docker compose up -d`, follow `docker compose logs -f ollama-models` |
| Something else | `docker compose ps` shows what's not running; `docker compose logs <name>` says why |

## What runs, and why

```
                ┌──────────────────────────── docker compose ─────────────────────────────┐
Browsers ──► caddy ──► web (Next.js) ──► api (+ live updates) ──► db (PostgreSQL + pgvector)
 (:80, :443)    └── /api/* ─────────────►  │  worker ───────────► valkey
                                           └──► ollama (AI, profile "ai")
                every service ── traces + metrics ──► otel-lgtm / Grafana (profile "monitoring")
```

| Service | Needed? | What it does |
|---|---|---|
| **caddy** | yes | The front door: HTTPS, lets other PCs in, sends `/api` to the API and pages to the website |
| **web** | yes | The website (Next.js + React) |
| **api** | yes | The data and the rules: names, timer history, songs, charts, Hobby Hub, live updates, the AI chat. Updates the database when it starts |
| **worker** | yes | Background jobs: achievements, the daily clean-up of old data, preparing songs and tips for the AI |
| **db** | yes | PostgreSQL: where everything is stored; pgvector lets the AI search by meaning |
| **valkey** | yes | Fast memory store: cache, rate limits, the job queue, live updates across services |
| **ollama** | AI only | Runs the AI models on your PC |
| **ollama-models** | AI only | Downloads the models, then stops (showing "Exited" is normal) |
| **otel-lgtm** | monitoring only | Grafana with traces, metrics and logs of every request |

## Coming from MyWeb

Nook was called **MyWeb** until Stage 9, and its database user, database and Docker volumes were named `myweb`.
A Nook install uses `nook` names, so it starts with a **fresh, empty** database. Your old data is still there,
in the `myweb_...` volumes. Choose one:

- **Keep your old data**: add these lines to `.env` (with your old `POSTGRES_PASSWORD`; the old default was `myweb`),
  then `docker compose up -d --build`:
  ```
  COMPOSE_PROJECT_NAME=myweb
  POSTGRES_USER=myweb
  POSTGRES_DB=myweb
  POSTGRES_PASSWORD=myweb
  ```
- **Start fresh** and delete the old data: `docker compose -p myweb down -v` (⚠️ removes the `myweb_...` volumes).

Either way, everyone picks their name again once (the cookie has a new name).

---

## For developers

Run each part yourself, with live reload. Needs Node.js 20.9+ and Docker (for PostgreSQL and Valkey).
Here each part has its own settings file: `api/.env` and (optional) `web/.env.local`.

```bash
cp .env.example .env                          # 1. the main settings (database password)
docker compose up -d db valkey                #    PostgreSQL + Valkey only

cd api && cp .env.example .env && npm install # 2. API: api/.env's DATABASE_URL must use the
npm run db:migrate && npm run db:seed         #    same password as POSTGRES_PASSWORD (default: nook)
npm run dev                                   #    http://localhost:4000/health
npm run worker                                #    background jobs (new terminal, in api/)

cd web && npm install && npm run dev          # 3. website (new terminal)
                                              #    http://localhost:3000
```

**Tests**: create the test database once, then run `npm test` in `api/` and in `web/`:

```bash
docker compose exec db createdb -U nook nook_test
```

GitHub Actions runs all tests, plus a full Docker start, on every push.

**AI**: `docker compose up -d ollama-models` starts Ollama and downloads the models (or install
[Ollama](https://ollama.com) yourself), then set `OLLAMA_URL=http://127.0.0.1:11434` in `api/.env`.
See [docs/stage-9.md](docs/stage-9.md).

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
.env.example           every setting for Docker, explained (copy to .env)
start.cmd, start.sh    1-click start
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
10. Games in the browser — Mini Arcade (canvas, game loop, high scores); better music player ✅ · [docs](docs/stage-10.md)
11. Community — Hobby Hub (groups, posts, live chat); names instead of accounts; keeping data only for a while ✅ · [docs](docs/stage-11.md)
12. Other websites' data — WatchList (TVmaze + Jikan, caching, fallbacks); song upload fixes ✅ · [docs](docs/stage-12.md)
13. Every day, even offline — Habit & Reading Tracker (time zones, a reminder job, offline queue, service worker) ✅ · [docs](docs/stage-13.md)
14. Multiplayer — Arcade Online: Quiz Party, a game the server runs (rooms, state machine, fair play) ✅ · [docs](docs/stage-14.md)

Credits and licences: [CREDITS.md](CREDITS.md)
