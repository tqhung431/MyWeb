# Stage 25 — Chợ Đêm Brawl (Night Market Brawl)

**Goal:** a co-op action game for 1–4 friends on Nook Arena: pick a hero, walk through a night market and bonk the
trouble-makers back home. Everything runs on the game server, 20 times a second, like Ngõ Pháo.

Where: **Nook Arena → Chợ Đêm Brawl** (`/arena/brawl`). Design: "Stage 22 design: Nook Arena games" (Claude Docs).

## 1. The game

Five areas, four waves each: **Noodle Lane → Fruit Corner → Lantern Square → Toy Street → Karaoke Stage**.
Bosses wait at the end of Lantern Square (**the Umbrella Master**, who spins) and the Karaoke Stage (**the Karaoke
King**, who sends out sound-wave rings and calls rats to help). Nobody gets hurt for real: beaten trouble-makers
run off home.

| Hero | Plays like | Attack | Special (charges as you hit) |
| --- | --- | --- | --- |
| 🍜 The Chef | Tough, hits everyone in front | Ladle swing | Boiling Pot: a big splash that stuns |
| 🛵 The Shipper | Fast, quick hits | Quick jabs | Scooter Dash: zoom through the crowd |
| 🍵 Grandma | Helper | A slipper that flies and comes back | Tea Time: heals everyone and helps them up |
| 🎒 The Student | Hits hard from far away | Slingshot | Homework Storm: paper planes everywhere |

- **Trouble-makers:** pickpocket rats (quick, in groups), umbrella ninjas (dash at you), balloon sellers (keep away
  and throw balloons that burst into sticky confetti: slower feet, a little damage).
- **Dodge** (a short roll, you can't be hit) and **help a friend up**: when someone is knocked down, stand next to
  them for 2 seconds. Everyone down = the run is over.
- **Coins** are shared: every trouble-maker sent home gives everyone coins. Between areas there's a **snack stall**:
  bánh mì (+25 health, full heal), chè (special charges faster), cà phê sữa đá (faster feet), bánh xèo (harder
  bonks). Knocked-down heroes get back up for the stall.
- **More friends, tougher market:** each extra hero makes the trouble-makers sturdier and a wave a little bigger.
- **Controls:** WASD or arrows to walk, J/Space attack, K/Shift dodge, L/E special. **Gamepads** work (left stick
  or d-pad, A attack, B dodge, X/Y special). **Phone:** a stick on the left and three buttons on the right, under the
  market so they don't cover it.
- **Leaderboard:** furthest area, then wins, then the fastest win (`/api/brawl/leaderboard`).

## 2. How it works

```
browser ──brawl:stick (≈15×/s, only when it changes)──►  game server: stepBrawl() 20×/s  ──brawl:tick──► every browser
        ──brawl:act {attack|dodge|special|buy|ready}──►                                  └─ result → brawl_runs
```

- **Rules in one file** (`api/src/arena/brawl.ts`): pure functions, a seeded random number generator, the time
  passed in. The same file is copied to `web/features/arena/brawl/brawl.ts` (a test fails if they differ), so the
  browser can walk your hero with exactly the server's rules.
- **Smooth on screen:** your own hero moves the moment you press (prediction with the shared walking code) and is
  gently corrected by the server; everyone else is drawn 100 ms in the past, between two updates.
- **Finding the way:** the market has stalls in the way. Trouble-makers follow a "flow field": a map, refreshed a
  few times a second, of which way is shortest to the nearest hero, so they walk around stalls instead of getting
  stuck behind them.
- **Drawing:** PixiJS, loaded only during a run. The market (paving stones, stalls with awnings, lantern strings)
  is drawn once per area; heroes, enemies, slippers, paper planes, confetti, bonk stars and damage numbers on top.
  All drawn in code, our own art.
- **Rooms:** 4-letter code, up to 4 people, each a different hero; everyone says they're ready, the host starts.
  Leave before the start and your seat is freed; leave during a run and your hero stands still until you're back.
  Someone who opens the room late (or reloads) gets the current picture at once.
- **Results** go into `brawl_runs` (one row per hero; deleted with the person, like other data), and a win
  appears on Home → Live now ("… cleared the Night Market").

## 3. Tests

- `api/tests/brawl.test.ts`: the two copies match; walking and stalls; pathfinding around stalls; the chef's cone and
  the special charge; dodge and helping up; tea and the homework storm; confetti and the snack stall; **a team of 4
  bots wins** and a player who does nothing loses in the first area; solo bots never get stuck and every hero clears
  at least one area.
- `api/tests/arena.test.ts`: a run over the real game server (hero clash refused, ready, start, walking, attacking,
  a win saved for both players on the leaderboard, back to the room).
- `web/e2e/stage25.spec.ts`: two browsers pick heroes, get ready, start a run and fight.

## What wasn't tested

- **Balance for people.** The numbers were set with bots: a team of 4 bots wins in about 4–5 minutes; a bot alone
  usually clears 1–2 areas. People are slower and cleverer than bots, so a full run is probably 10–15 minutes.
  If it feels too hard or too easy, tell me which area and I'll tune it.
- **A real gamepad** (there's none in the sandbox; the code uses the standard browser Gamepad API).
- **A real phone's thumbs** (the phone layout was checked in an iPhone-sized browser), **frame rate on real
  hardware** and **sounds by ear**.
- **Four real devices at once**: tested with two browsers on one machine.
- The Vietnamese for the new texts was written by Claude.
