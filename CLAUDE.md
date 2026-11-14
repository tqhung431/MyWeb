# Nook: notes for Claude

Read this first in every session. It carries the context from the sessions that built Nook (Stages 1–27).

## The project

- **Nook** (repo `tqhung431/Nook`, called **MyWeb** until Stage 9): a self-hosted hub of free-time apps
  for everyone on a home network. It's the owner's **web programming learning project for 2026**.
- The learning plan is the Claude Docs artifact "Web Programming Learning Plan 2026":
  https://claude.ai/artifact/SxwvQ9psg9j8iuBXmh1Gvc. Read it before starting a new stage.
- Work goes stage by stage. Done: 1 static page · 2 Next.js · 3 API + PostgreSQL · 3.5 frontend review and
  design system · 4 guests-first accounts, LAN access · 5 Valkey cache/queue/worker · 6 Socket.IO real time ·
  7 Docker Compose + Caddy · 8 GitHub Actions + OpenTelemetry/Grafana · 9 local AI with Ollama ·
  10 Mini Arcade (canvas games, high scores) + music player controls · 11 Hobby Hub, names instead of accounts, data retention ·
  12 WatchList (TVmaze + Jikan, no keys) + song upload fixes (Next proxy 10 MB body limit, UTF-8 file names) ·
  13 Habit & Reading Tracker (calendar days in the user's time zone, reminder job every minute, offline queue, PWA) ·
  14 Arcade Online: Quiz Party (server-run game state machine in memory, Socket.IO rooms `ao:<code>`, results in DB).
  15 Design system: 6 palettes × light/dark (`web/app/palettes.css`, `data-palette` on <html>, contrast test), own `Select`
  (no native `<select>` anymore), `Dialog`/`useConfirm()` (no `window.confirm`), `Toast`/`useToast()`, `/design` gallery,
  Figma library "Nook design system" (https://www.figma.com/design/G3numOlj2x4L7kiiSlBuGT; owner's Starter plan:
  few Figma MCP calls allowed, batch work into one big `use_figma` script).
  16 Nook Games (`/games`) + Vân Lộ (`web/features/games/van-lo`: engine/ logic/ ui/; rules are pure and seeded, `act(game, action)`
  returns Fx for the canvas; saves in localStorage + `game_saves` via `/api/games/saves/:game`, 200 KB JSON limit on that router).
  Design doc (GDD): https://claude.ai/artifact/QM1LQ8eTLMeMeV9j6h62Tu. Plan doc: https://claude.ai/artifact/Y1ay2pTtsr6T3a7pDDV24d.
  17: six paths (`logic/paths.ts`: abilities/treasures are `Effect` data run by `applyEffect()`), Binh gia allies on `floor.allies`,
  realms to Nguyên Anh (shared `curve()`), 4 secret realms with hazards, furnace (`logic/craft.ts`), Web Audio music/sfx (`ui/audio.ts`),
  save v2 (`upgradeFromV1`). Balance with a throwaway bot script (tsx from api/node_modules) before changing numbers.
  18: hero sprites per path in `ui/sprites.ts` (drawn in code, cached offscreen canvases, `drawProp` for props), `ui/particles.ts`,
  hold-to-walk + `Joystick.tsx`, lighting/soft mist in `Board.tsx`, urns/crates/shrines/merchant (`BLOCKING` things, `buy` action),
  leaderboard (`game_saves.path/level/kills`, `GET /api/games/leaderboard/:game`), light-effects mode, `/games/van-lo/assets` gallery.
  Music charts take `limit/offset/q` (X-Total-Count). Repo licence: MIT (`LICENSE`).
  19: Playwright e2e (`web/e2e`, `npm run e2e`; each test makes its own data; CI runs them through Caddy at https://localhost),
  Lighthouse (`quality/lighthouse.mjs`, phone settings, all pages ≥ 90; CI perf floor 80), k6 (`quality/k6/load.js`, STRESS=1;
  built locally with `go install go.k6.io/k6@v1.3.0`, CI uses the grafana/k6 image), OpenAPI from the routes' Zod schemas
  (`api/src/openapi.ts`, `GET /api/openapi.json`, page `/developers`; test fails if a route is missing). Speed rules: no animated
  blur behind backdrop-blur cards, CSS inlined (`inlineCss`), reserve space for late content, name prompt opens after first interaction.
  Measure Lighthouse on a production build (`npm run build`, standalone server), never dev mode. Arcade: 3-2-1 countdown, Space/Enter.
  20: remote access without open router ports. Recommended Tailscale on the host (`tailscale serve --bg 80`); optional profile
  `tunnel` (cloudflared → Caddy `:8080`, unpublished) with Caddy `forward_auth` → API `GET /internal/access-check`, which verifies
  the Cloudflare Access JWT (jose, team JWKS, iss + AUD, fail closed without CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD). API trusts
  private-range proxies (TRUST_PROXY "loopback, linklocal, uniquelocal"); `BIND_IP` for Caddy's ports; start scripts make a random
  DB password on fresh installs; X-Frame-Options + Permissions-Policy. Never suggest port forwarding: Nook has no passwords.
  Caddy can be built locally for tests: `go install github.com/caddyserver/caddy/v2/cmd/caddy@v2.11.0`.
  Cloud VM is OPTIONAL, not the default (owner's choice: Nook runs on a home PC). docs/deploy-gcp.md: nginx (`deploy/nginx/nook.conf`: basic auth, certbot, Host $http_host, XFF=$remote_addr,
  WebSocket upgrade, 110m body, no buffering) → Caddy `:8081` (trusts private ranges; published on 127.0.0.1:PROXY_PORT only via
  `COMPOSE_FILE=docker-compose.yml:deploy/nginx/compose.proxy.yml`).
  21: Hobby Hub private chats (`direct_messages`, routes/messages.ts, events `dm:*` to `user:<id>` rooms), members-only
  writing + `group_members.last_read_at` unread counts, `UnreadProvider` badge, chat pictures (`chat_images`, bytes checked in
  `api/src/hobby/images.ts`, files in MEDIA_DIR/chat, swept by cleanup), shared `ChatPanel`. i18n without a library:
  `web/lib/i18n` (`t("English text")`, `tx()` for data, `tNow()` outside React, `getT()` on the server, `vi.json`;
  `tests/i18n.test.ts` fails on a missing text: add Vietnamese for every new t("…")). Cookie `nook_lang`; API errors
  translated in errorHandler (`api/src/i18n.ts`); activity feed = template + params ("_" keys are translated).
  Vân Lộ keeps its own vi/en texts. `/settings` holds language + theme (no theme buttons in the shell).
  22: Nook Arena (`/arena`) + Nook TV (`/tv`). Game server = its own process (`api/src/arena.ts`, service `arena`, port
  ARENA_PORT 4100, Socket.IO path `/api/arena`; Caddy `handle /api/arena*` → ARENA_UPSTREAM; Next rewrite → ARENA_URL).
  API routes must NOT start with /api/arena (they'd go to the game server): `/api/admin`, `/api/tv`, `/api/chess/*`.
  Rules without network code in `arena/chess-game.ts` (chess.js) and `arena/listen.ts` (server-time sync); rooms in memory,
  results in `chess_games` / `arena_ratings` (Elo K=32). Web: `features/arena/ArenaProvider` (opened only in /arena and /tv,
  clock offset), chess `Board.tsx` (SVG pieces in `pieces.tsx`), own fast engine `engine.ts` (0x88, perft-tested, Web Worker).
  Admin = `ADMIN_PASSCODE` in .env, flag on the session (`auth_sessions.is_admin`), Settings → Admin. Nook TV: YouTube
  (youtube-nocookie embeds, oEmbed titles) chosen by the admin; screen share = WebRTC peer-to-peer, server only relays
  signals. Owner's rule: never add links/presets to unofficial streaming sites.
  23: Ngõ Pháo (`/arena/alley`): rules in `api/src/arena/alley.ts` (pure, seeded, `stepAlley(g, now, dt)` 20×/s from
  `alleyTick()` in server.ts, bots with a danger map), lobby in `alley-room.ts`; `alley-move.ts` exists twice
  (api + `web/features/arena/alley/`) and must stay byte-identical (test). Web: PixiJS 8 loaded only in `GameView`
  (`renderer.ts`: interpolation 100 ms for others, prediction for you; `art.ts` draws textures in code; menus use the
  SVG `LanternHead` and `colors.ts` so they don't load PixiJS). Wins in `arena_ratings` (game "alley"), `/api/alley/leaderboard`.
  24: Giữ Làng (`/arena/village`): rules in `village.ts`, no imports/no randomness, TWO byte-identical copies (api/src/arena +
  web/features/arena/village; test). Solo runs in the browser (`VillageSolo`, saves in localStorage + cloud save game "village"),
  co-op on the game server (`village:*`, VillageRoom in server.ts, sides 0/1). `ViewFeed` feeds both the Pixi renderer and the
  React HUD (HUD redraws only on change). Scores in `village_scores` (`/api/village/scores`, `/api/village/leaderboard?map=`).
  Balance with a bot before changing numbers (the "is winnable" test).
  25: Chợ Đêm Brawl (`/arena/brawl`): rules in `brawl.ts` (pure, seeded), TWO byte-identical copies (api/src/arena +
  web/features/arena/brawl; test). BrawlRoom in server.ts (`brawl:*`, stepped from `alleyTick()`, tick "brawl:tick";
  room:join sends the current view). Enemies use a flow field around stalls. `brawl_runs`, `/api/brawl/leaderboard`.
  Controls: keys, Gamepad API, phone stick under the canvas. Playwright: a fullPage screenshot resets phone touch emulation.
  26: Mầm Thú part 1 (`/arena/sprout`, runs in the browser): rules in `sprout.ts` (species, moves, Ngũ Hành tames/feeds,
  battles, `aiAction`), TWO byte-identical copies (api/src/arena + web/features/arena/sprout; test) for Stage 27's server
  battles. Island = `island.ts` (6 areas of 20×12 chars, keepers, villagers; its texts need vi.json entries, checked by
  web/tests/sprout-texts.test.ts). Canvas 2D island, SVG creatures (`Creature.tsx`), saves = localStorage + cloud game "sprout"
  (board: level = shrines, kills = kinds befriended). Balance: the island bot in api/tests/sprout.test.ts.
  27: People and admin (plan doc: https://claude.ai/artifact/PHVwfsrDBnQfo9FZSamKMZ). Names have a PIN (scrypt hash
  `users.pin_hash`, never cached/sent); `/api/me/sign-in` (10 wrong = 15 min lock), device codes (5 min) and admin claim
  codes (24 h, clear the PIN) in `sign_in_codes` (hash only); devices = `auth_sessions` (+`last_used_at`); deleted names
  reserved 30 days (`reserved_names`). Admin = passcode holder on a browser, NEVER a role on a name (owner's rule);
  passcode ≥ 16 chars, only over https/localhost (`ADMIN_REQUIRE_HTTPS`), 12 h (`admin_until`), everything in `admin_log`
  (`logAdmin`). `/admin` page (People, Reports, Content, Nook banner/storage/log, Health). Admin can't read private chats,
  only reported messages. Paused users: `blockPaused`. Locked groups: `hobby_groups.locked`. No server commands in pages
  (owner's rule): point to docs / Admin → Health. Owner's rule: Nook stores no emails.
  28: Chat and privacy. Private chats = Messages app (`/messages`, pinned; Music unpinned; old /hobby-hub/messages
  redirects in next.config). Deleting = soft delete (`deleted_by` author|admin, body "", picture file removed:
  `api/src/hobby/erase.ts`), "Message deleted" stays in place; Undo = ChatPanel waits 5 s before calling the API;
  edit for 10 min (`edited_at`). `MessageMenu.tsx` (tap / right-click / ⋯). Feed: focus, WatchList, listening never
  published; milestones only via `publishMilestone()` when `preferences.shareMilestones` (Settings → Privacy);
  `recentActivity()` hides old private lines. Admin sign-in log = `sign_ins` (who, how, user agent; 90 days).
  AppHeader: apps with >4 tabs put them on their own wrapping line. Language buttons show EN/VI, not flags.
  Next (plan): Stage 29 tidy menus +
  English-first games (Vân Lộ = "Cloud Path" in English, "Vân Lộ" in Vietnamese, never "Đường Mây"), then Mầm Thú part 2.
  Original world only: don't copy names/characters/plots from existing novels or films.
  Each stage has an explainer in `docs/stage-N.md`; write one for every new stage and update the README's stage list.
- Apps: **Chill Corner** (focus timer, generated sounds, tips, achievements), **Music** (uploaded songs
  stored and streamed by Nook, auto genre, charts, queue/shuffle/repeat/volume), **Mini Arcade** (6 games in
  `web/features/arcade/games`, rules in `logic/` with tests, scores in `game_scores`), **Free-time Companion**
  (Ollama + pgvector RAG, SSE streaming). **Hobby Hub** (groups, posts, comments, likes, live chat via Socket.IO rooms `group:<slug>`).
  **WatchList** (`api/src/watch/sources.ts`; tests use `tests/fake-watch.ts` on port 4995).
  **Habit & Reading Tracker** (`/habits`: days are `date` strings in X-Time-Zone; `web/lib/offline.ts` queue; `public/sw.js`).
  **Arcade Online** (`api/src/arcade-online/`: game.ts has no network code; tests use a fake clock).
  **Nook Arena** (`/arena`: chess, Ngõ Pháo, Giữ Làng, Chợ Đêm Brawl, Mầm Thú, Listen Together) and **Nook TV** (`/tv`), Stages 22–26.
- Phone tab bar: Home + apps with `pinned: true` + an "Apps" grid. Don't pin more than 3–4 (Stage 28: Chill Corner, Messages, Hobby Hub).
- People (Stage 11): **name only** (owner's choice): no email/password. Stage 27 added a PIN per name to sign in on other devices. `POST /api/me {name}`
  sets the `nook_session` cookie; names unique by lower(name). Guests (X-Client-Id) still work until they pick a name.
  Data retention (owner's choice: "store data but not for too long"): worker job `cleanup` daily deletes people unseen for
  `DATA_RETENTION_DAYS` (90) with cascade, chat after `CHAT_RETENTION_DAYS` (30). New user-linked tables need `onDelete: cascade`.

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
**Merging (when asked):** open the PR, then WAIT for the PR's own CI run to finish green before merging. A green run on
the branch push isn't enough: flaky tests and parallel e2e runs can still fail (Stage 19's merge broke main this way).
Phone layouts: a `grid` with only `sm:`/`lg:grid-cols-…` sizes its phone column to the widest child; always add `grid-cols-1`.

## Sandbox tips

- Services stop when the sandbox restarts: `service postgresql start` and
  `redis-server --daemonize yes --dir /tmp` (the `--dir` keeps `dump.rdb` out of the repo).
- PostgreSQL needs pgvector (`apt-get install -y postgresql-16-pgvector`) and the `nook` user (password `nook`)
  with databases `nook` and `nook_test`. The environment's setup script does this.
- Tests use a **fake Ollama** (`api/tests/fake-ollama.ts`, ports 4996/4997). If tests hang on ports, kill
  leftovers: `fuser -k 4995/tcp 4996/tcp 4997/tcp 4998/tcp 4999/tcp`.
- Run the app for a browser check: `npm run dev` in `api/` (with `OLLAMA_URL` set if needed), `npm run worker`, `npm run arena`,
  `npm run dev` in `web/`. Dev mode keeps a long-polling connection open: in Playwright wait for `load`, not
  `networkidle`. Launch Chromium with `--no-proxy-server --proxy-bypass-list=localhost`.
- Production-like check: build, run the Next standalone server (`cp -r .next/static .next/standalone/.next/static`),
  Caddy from source (Go) with `API_UPSTREAM=127.0.0.1:4000 WEB_UPSTREAM=127.0.0.1:3000`.
- Free a port: `fuser -k 3000/tcp`.
- The sandbox reaches the internet only through a proxy that Node's fetch ignores: start the API with
  `NODE_USE_ENV_PROXY=1 npm run dev` to try WatchList. api.tvmaze.com is allowed; api.jikan.moe never answers from the
  sandbox (anime is only tested against the fake); poster images (static.tvmaze.com) are blocked.
- `npm run dev` in `api/` needs `api/.env` (copy `api/.env.example`) and a migrated dev DB (`npm run db:migrate && npm run db:seed`).
- Code style: Prettier-like with long lines (`npx prettier --print-width 160`); there is no Prettier config in the repo.
