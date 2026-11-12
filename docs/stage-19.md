# Stage 19 — Quality and speed: browser tests, Lighthouse 90+, a load test, API docs, a smoother Mini Arcade

**Goal:** prove Nook works and is fast, every time code changes. A real browser now clicks through the apps on every
push, every page scores 90+ on Lighthouse, a load test checks a party of 50 people, and the API has documentation made
from its own code. The Mini Arcade got smoother graphics and a friendlier start and finish.

These are the "done when" checks from the learning plan's phases 2 and 4 (Playwright, Lighthouse 90+, k6, OpenAPI).

## 1. Mini Arcade: smoother, friendlier

| Change | Why |
| --- | --- |
| **Hungry Worm glides** | The rules still move the worm one cell at a time (8–15 times a second), but each frame now draws every segment part of the way between its last cell and its new one (*interpolation*). On a 120 Hz screen that's 120 drawings a second instead of 8 jumps. |
| Grass painted once | The 256 squares of grass were drawn every frame; now they're drawn once into an offscreen canvas and copied. |
| Crumbs and a shake | Crumbs fly when the worm eats; the board shakes when it crashes. |
| Sharpness capped at 2× | On 3× phone screens, drawing 3× the pixels costs more and looks the same. Pancake Tower too. |
| Frame-rate-independent camera | Pancake Tower's camera glides the same at 60 or 120 fps (`1 − 0.92^frames` instead of a fixed 8% per frame). |
| **3-2-1 countdown** | Every game starts with a countdown and a "go!" sound, so you're ready. |
| **Space / Enter** | Starts the game and plays again (no reaching for the mouse). |
| Your best on the start screen | So you know what to beat. |
| **Confetti** for a new best | One canvas, 140 pieces of paper, gone after 2.5 s (not shown if you asked your device for less motion). |

## 2. End-to-end tests (Playwright)

Unit tests (Vitest) check one function at a time. **End-to-end (E2E) tests** start a real browser and use Nook like a
person: they click buttons, type, and check what appears. They catch problems no unit test sees: a button that
doesn't respond, a page that crashes in the browser, a broken link between the website and the API.

`web/e2e/` (run with `npm run e2e` in `web/`):

| Test | What it does |
| --- | --- |
| `smoke.spec.ts` | Opens 12 pages and fails on any JavaScript error |
| `people.spec.ts` | Picks a name on the You page; adds a habit; starts a Hobby Hub group and posts in it |
| `arcade.spec.ts` | Plays Hungry Worm into a wall: countdown, game over, score saved with a rank; Space plays again |
| `vanlo.spec.ts` | Makes a cultivator, enters a secret realm, walks around |
| `phone.spec.ts` | On a phone screen: the tab bar works, no sideways scrolling |

Each test is a new person (a fresh browser with no cookies), and makes its own data (its own group, a random name),
so tests never depend on each other or on what's already in the database. That also means they leave test data
behind (a group called "Robots …", a few scores): run them against a development Nook, not the one your family uses.

In CI, they run against the **real Docker setup through Caddy** (`https://localhost`), after the images are built.
If one fails, the report and a screenshot are kept as a download on the GitHub Actions run.

## 3. Lighthouse 90+

Lighthouse (Google's page checker) loads a page as **a mid-range phone on a slow 4G connection** and scores
performance, accessibility, best practices and SEO from 0 to 100. `quality/lighthouse.mjs` checks every app page
and fails if a score is under 90.

What was slow, and what fixed it:

| Problem | Fix | Effect |
| --- | --- | --- |
| The background's three huge **blurred circles drifted forever**, under frosted-glass cards (`backdrop-blur`). Every frame, the phone re-blurred them and every card above them | Still radial gradients: the same soft look, painted once | Seconds less main-thread work |
| The CSS was a separate file the browser had to fetch before drawing anything | `inlineCss` in `next.config.ts`: the 16 KB of CSS ride inside the HTML | ~0.3 s sooner on a phone |
| The **"pick a name" box** opened the moment the page loaded and became the biggest thing on screen, late | It opens a moment after you first scroll, tap or type | Home LCP 3.5 s → 1.0 s, and it no longer covers what you were about to click |
| Home's "Recent activity" grew when it loaded, pushing the page down (*layout shift*) | Room for 6 rows from the start | CLS 0.21 → ~0 |
| Vân Lộ showed a spinner until all of the game's code arrived | The loading view is the real title card (from the server's HTML) | Performance 83 → 100 |
| The Companion asked the API from the browser | The server asks first; the page arrives complete | |
| Two small contrast failures ("Pick a name" button, purple links) | A background on the button; Nook's purple a shade darker (#684bf8, 4.8:1) | Accessibility 96 → 100 |

Scores after (production build, phone settings):

| Page | Performance | Accessibility | Best practices | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| / | 97 | 100 | 100 | 100 | 1.0 s | 200 ms |
| /chill | 90 | 100 | 100 | 100 | 1.0 s | 420 ms |
| /music | 99 | 100 | 100 | 100 | 1.0 s | 120 ms |
| /arcade | 99 | 100 | 100 | 100 | 1.0 s | 100 ms |
| /arcade/worm | 97 | 100 | 100 | 100 | 1.0 s | 200 ms |
| /watchlist | 99 | 100 | 100 | 100 | 1.0 s | 140 ms |
| /hobby-hub | 100 | 100 | 100 | 100 | 1.0 s | 80 ms |
| /habits | 99 | 100 | 100 | 100 | 0.9 s | 140 ms |
| /arcade-online | 100 | 100 | 100 | 100 | 0.9 s | 70 ms |
| /games | 99 | 100 | 100 | 100 | 1.0 s | 110 ms |
| /games/van-lo | 100 | 100 | 100 | 100 | 1.0 s | 90 ms |
| /companion | 99 | 100 | 100 | 100 | 1.0 s | 130 ms |
| /about | 100 | 100 | 100 | 100 | 1.0 s | 70 ms |
| /developers | 94 | 100 | 100 | 100 | 0.9 s | 280 ms |
| /design | 96 | 96 | 100 | 100 | 0.9 s | 220 ms |

**LCP** (Largest Contentful Paint) is when the biggest thing on screen appears; under 2.5 s is "good".
**TBT** (Total Blocking Time) is how long the page was too busy to respond to a tap; under 200 ms is "good".

In CI the minimum for performance is 80 instead of 90: GitHub's machines are shared, so timing varies from run to
run. Accessibility, best practices and SEO must be 90+.

## 4. Load test (k6)

A home network rarely has more than ~10 people at once. `quality/k6/load.js` checks what happens at a party: k6
starts *virtual users* that act like people (open the charts and tips, look at a leaderboard, play a round, save the
score), ramping to **50 at once**. The test fails if more than 1% of requests fail or if 95% don't answer within 0.3 s
(0.5 s for saving).

Results on the sandbox (production build of the API, one process):

| Run | Requests | Errors | 95% answered within | Throughput |
| --- | --- | --- | --- | --- |
| 50 people, with pauses like real people | 952 in 1 minute | 0 | 6 ms | ~15 a second |
| `STRESS=1`: the same 50, no pauses | 66,208 in 1 minute | 0 | 57 ms | **~1,100 a second** |

So a home network is nowhere near the limit. (The first run found a bug *in the test*: it sent Silly Pairs scores
under 8 moves, which the API correctly refuses.)

Saving scores is off unless you add `WRITES=1`: on your real Nook it would fill the leaderboards with fake guests
(that's how I found out). In CI it runs with `WRITES=1` against the Docker setup through Caddy, with k6's own Docker image (`grafana/k6`): nothing to install.

## 5. API docs (OpenAPI)

**OpenAPI** is the standard way to describe an HTTP API so people and tools can read it (docs sites, Postman,
Bruno, code generators).

- `GET /api/openapi.json`: the whole API (70 endpoints) in OpenAPI 3.1.
- **`/developers`**: a readable page made from it on the server: every endpoint by app, who can call it (anyone, a
  guest id, or a name), and the fields it takes with their limits. Linked from About.

The rules are **not written twice**: `api/src/openapi.ts` imports the same Zod schemas the routes use to check input,
and Zod 4's own `z.toJSONSchema()` turns them into JSON Schema. So when a route's rules change, the docs change too.
`api/tests/openapi.test.ts` reads every route in `src/routes` and fails if one is missing from the docs, or if the docs
list one that doesn't exist.

## 6. Where things are

```
web/e2e/                  Playwright tests            web/playwright.config.ts
quality/lighthouse.mjs    Lighthouse on every page    quality/k6/load.js   the load test
api/src/openapi.ts        the OpenAPI document        web/app/developers   the docs page
web/features/arcade/      Confetti.tsx, GameShell.tsx (countdown), games/Worm.tsx (interpolation)
```

Run them yourself:

```bash
cd web && npm run e2e                                          # dev servers running
cd web && npm run build && npm start                           # then, in quality/:
cd quality && npm install && BASE_URL=http://localhost:3000 npm run lighthouse
k6 run quality/k6/load.js                                      # https://k6.io (or the grafana/k6 Docker image)
```

## What wasn't tested

- Lighthouse scores were measured in the sandbox; GitHub's machines and your PC will differ a little.
- The worm's smoothness was checked in a browser in the sandbox, not on a 120 Hz phone.
