# Nook: notes for Claude

Read this first in every session. It carries the context from the sessions that built Nook (Stages 1–10).

## The project

- **Nook** (repo `tqhung431/Nook`, called **MyWeb** until Stage 9): a self-hosted hub of free-time apps
  for everyone on a home network. It's the owner's **web programming learning project for 2026**.
- The learning plan is the Claude Docs artifact "Web Programming Learning Plan 2026":
  https://claude.ai/artifact/SxwvQ9psg9j8iuBXmh1Gvc. Read it before starting a new stage.
- Work goes stage by stage. Done: 1 static page · 2 Next.js · 3 API + PostgreSQL · 3.5 frontend review and
  design system · 4 guests-first accounts, LAN access · 5 Valkey cache/queue/worker · 6 Socket.IO real time ·
  7 Docker Compose + Caddy · 8 GitHub Actions + OpenTelemetry/Grafana · 9 local AI with Ollama ·
  10 Mini Arcade (canvas games, high scores) + music player controls.
  Each stage has an explainer in `docs/stage-N.md`; write one for every new stage and update the README's stage list.
- Apps: **Chill Corner** (focus timer, generated sounds, tips, achievements), **Music** (uploaded songs
  stored and streamed by Nook, auto genre, charts, queue/shuffle/repeat/volume), **Mini Arcade** (6 games in
  `web/features/arcade/games`, rules in `logic/` with tests, scores in `game_scores`), **Free-time Companion**
  (Ollama + pgvector RAG, SSE streaming). Planned ("soon" in `web/lib/apps.ts`): WatchList, Hobby Hub, Habit & Reading Tracker, Arcade Online.

## Working with the owner

- They read on a **phone**: short messages, outcome first, plain words, no invented jargon.
- They often add feature requests and bug reports alongside "Stage N": handle all of them.
- Show the UI: take Playwright screenshots (desktop + iPhone 13) and send them.
- Be honest about what wasn't tested (e.g. real Ollama models can't run in the sandbox).
- Don't create pull requests or merge unless asked. Never put model names in commits, code or docs.
- Don't bypass bot checks or download restrictions on other sites (e.g. ccMixter blocks direct downloads:
  the owner downloads songs themselves).

## Layout

```
web/   Next.js 16 App Router, React 19, TS, Tailwind 4 (tokens, dark mode via [data-theme=dark]), Lucide icons
  app/ (routes only) · features/<app>/ · components/{ui,shell}/ · lib/apps.ts (app registry) · lib/api/ (apiFetch)
api/   Express 5 (ESM), Zod, Drizzle ORM + drizzle-kit, BullMQ worker, Socket.IO (redis adapter/emitter)
  src/routes · src/ai · src/jobs · src/realtime · src/db (schema.ts, migrate.ts, seed) · drizzle/ (migrations)
docker-compose.yml  project name "nook"; COMPOSE_PROFILES in .env: app, ai, monitoring
Caddyfile · start.cmd / start.sh (1-click) · .env.example (the only Docker settings file) · .github/workflows/ci.yml
```

- Adding an app: entry in `web/lib/apps.ts` + `app/<href>/page.tsx` (a test fails if a live app has no page).
- Schema change: edit `api/src/db/schema.ts`, `npm run db:generate` in `api/`. drizzle-kit asks interactively
  about renames, which hangs: split renames into separate migrations (drop, then add).
- Internal names are `nook` (DB user/db, cookie `nook_session`, queue, metrics `nook.*`, OTel `nook-api`).
  Old MyWeb installs keep data with COMPOSE_PROJECT_NAME/POSTGRES_USER/POSTGRES_DB=myweb (README).

## Checks before every push

```bash
cd api && npx tsc --noEmit && npm test            # needs PostgreSQL + Valkey (below)
cd web && npx tsc --noEmit && npm test && npm run build
docker compose config -q                           # no Docker daemon in the sandbox; CI does the real Docker run
```

After pushing, check the GitHub Actions run (api, web, docker smoke test through Caddy) with the GitHub tools.

## Sandbox tips

- Services stop when the sandbox restarts: `service postgresql start` and
  `redis-server --daemonize yes --dir /tmp` (the `--dir` keeps `dump.rdb` out of the repo).
- PostgreSQL needs pgvector (`apt-get install -y postgresql-16-pgvector`) and the `nook` user (password `nook`)
  with databases `nook` and `nook_test`. The environment's setup script does this.
- Tests use a **fake Ollama** (`api/tests/fake-ollama.ts`, ports 4996/4997). If tests hang on ports, kill
  leftovers: `fuser -k 4996/tcp 4997/tcp 4998/tcp 4999/tcp`.
- Run the app for a browser check: `npm run dev` in `api/` (with `OLLAMA_URL` set if needed), `npm run worker`,
  `npm run dev` in `web/`. Dev mode keeps a long-polling connection open: in Playwright wait for `load`, not
  `networkidle`. Launch Chromium with `--no-proxy-server --proxy-bypass-list=localhost`.
- Production-like check: build, run the Next standalone server (`cp -r .next/static .next/standalone/.next/static`),
  Caddy from source (Go) with `API_UPSTREAM=127.0.0.1:4000 WEB_UPSTREAM=127.0.0.1:3000`.
- Free a port: `fuser -k 3000/tcp`.
- `npm run dev` in `api/` needs `api/.env` (copy `api/.env.example`) and a migrated dev DB (`npm run db:migrate && npm run db:seed`).
- Code style: Prettier-like with long lines (`npx prettier --print-width 160`); there is no Prettier config in the repo.
