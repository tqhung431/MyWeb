# Stage 24 — Giữ Làng (Keep the Village)

**Goal:** a tower-defense game on Nook Arena: alone in your browser (saved between waves), or with a friend on the
game server, one map, each guarding their own path.

Where: **Nook Arena → Giữ Làng** (`/arena/village`). Design: "Stage 22 design: Nook Arena games" (Claude Docs).

## 1. The game

Mischievous spirits walk two winding paths to the village granary to steal rice (they don't hurt anyone). Lose 20 sacks
and the night is lost; survive **30 waves** and the village is safe. Or play **endless**.

| Defender | What it does | Upgrades (pick one way, then upgrade once more) |
| --- | --- | --- |
| 🏹 Bamboo archer | Fast shots at walking spirits | Rapid fire / Piercing arrows |
| 🏮 Lantern post | Slows spirits in its light | Wider light / Burns |
| 🥁 Temple drum | Stuns everything nearby every few seconds | Louder / Longer stun |
| 🪁 Kite flyer | The only one that hits flying paper-cranes | Twin kites / Long range |
| 🛒 Rice-cake cart | Coins after every wave | Faster (coins during waves) / Bigger |

- **Spirits:** quick fox-wisps, armoured rock-turtles, flying paper-cranes (straight to the granary, over everything),
  slime-gourds that split in two, and every 10 waves the **Moon-Rabbit of Mischief**.
- **Maps:** Riverside, Terraces (rice paddies) and Night Festival.
- **Coins:** for every spirit, after every wave, and for calling a wave early (the seconds you skip).
- **Controls:** tap a free spot beside the path → pick a defender. Tap a defender → upgrade or sell (70% back).
  ×1/×2 speed and pause. Keyboard: Space calls the next wave, P pauses, Esc closes the menu.
- **Score:** waves × 100 + rice left × 25 (+500 for saving the village). Best per person on each map.

## 2. How it works

- **One set of rules, two places.** `village.ts` has no imports, no randomness and takes the time as a number. The
  same file runs in your browser for solo games and on the game server for co-op (a test fails if the two copies
  differ). The same moves always give the same game, which makes it easy to test and to balance.
- **Solo** runs 20 steps a second in the page (×2 speed = bigger steps). Between waves the game is saved in the
  browser, and in Nook if you have a name (Nook Games' cloud saves, game `village`), so **Continue** works on
  another device too. The result goes to `POST /api/village/scores`.
- **Co-op** (`village:*` messages): the host picks the map and starts; player 1 builds by the first path,
  player 2 by the second; coins are separate (each gets their share of every spirit). The server saves both
  players' result when the game ends. If someone's browser closes, the game carries on.
- **Drawing:** PixiJS again (loaded only during a game). The whole map (grass, paddies, water, paths, trees,
  festival lights) is drawn once into one picture; defenders, spirits, arrows, kites, drum rings and coin
  numbers are sprites on top. Spirits slide smoothly between the 20 updates a second.
- **Balance** was set with a bot: with no defenders the rice is gone by wave 2-3; building without upgrading
  reaches about wave 20; a sensible mix with upgrades wins on every map with 14–16 sacks left
  (that bot is now a test).

## 3. Tests

- `api/tests/village.test.ts`: the two copies match; maps (paths stay on the map, straight segments, same granary,
  spots on both sides); build/upgrade/sell and coins; calling early; rice stolen and losing; only kites hit
  cranes; lantern slow, drum stun, gourds splitting; co-op sides and coins; save and load; the balance bot wins
  every map and doing nothing loses early.
- `api/tests/arena.test.ts`: co-op over the real game server (sides enforced, a wave starts, towers owned);
  solo scores and the leaderboard (impossible results refused).
- `web/e2e/stage24.spec.ts`: a solo game in the browser, calling the first wave early.

## What wasn't tested

- **Frame rate on real hardware** (the sandbox draws in software: 15–20 fps with one browser; the game's own work
  per frame is small). The fps number shows under the map.
- **Tapping on a real phone**: spots are about 24 px wide on an iPhone in portrait. Turning the phone sideways
  makes them bigger. If they're too small to hit, tell me and I'll add zoom.
- **A full 30-wave game by a person**, and **sounds by ear**.
- **Two real devices**: co-op was tested with two browsers on one machine (the wave reached both in 0.3 s).
