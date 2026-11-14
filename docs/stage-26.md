# Stage 26 — Mầm Thú (Sproutlings), part 1: the island

**Goal:** a creature adventure of Nook's own: walk a small island, befriend the sproutlings that live there, grow
together, and wake its six shrines. Part 2 (Stage 27) adds battles and swaps between people, 18 more sproutlings and
your own garden.

Where: **Nook Arena → Mầm Thú** (`/arena/sprout`). Design: "Stage 22 design: Nook Arena games" (Claude Docs).
Original world: the island of Thanh Khê after a storm scattered its seed-spirits.

## 1. The game

- **Start:** choose your first sproutling: Giọt (Water), Mầm Tre (Wood) or Than Hồng (Fire).
- **The island:** six areas, from the fishing village to the windy peak: Làng Chài, Rừng Tre, Đồi Bếp,
  Bãi Đất Sét, Chùa Chuông, Đỉnh Gió. Each has tall grass (wild sproutlings), villagers with tips, a **shrine**
  (rest; grow up) and a **shrine keeper**. Beat the keeper in a friendly battle and the gate to the next area opens.
- **Sproutlings:** 12 kinds to meet (2–4 of each element) and 5 grown forms. Giọt → Sóng Giọt, Mầm Tre → Lũy Tre,
  Than Hồng → Bếp Lửa, Gốm → Lò Gốm, Chuông Nhỏ → Đại Chuông, from level 12, **only at a shrine and only when you
  choose**.
- **The Five Elements (Ngũ Hành):** Water → Wood → Fire → Earth → Metal → Water.
  - *Tames* (khắc): each element tames the one two steps on (Water tames Fire…). A move that tames hits 1.5× as hard;
    the other way round only 0.6×.
  - *Feeds* (sinh): a friend on the bench whose element feeds the one fighting gives it 5% health every turn. So
    the order of your team matters, not just strength.
- **Battles:** turn-based, up to 3 against 3, one at a time. Four moves each (one big signature move per element),
  switching costs your turn, the faster one moves first. Moves can heal, guard, put to sleep, slow, soften or fire
  up. Everyone who's still standing shares the experience.
- **Befriending, not catching:** in a wild battle, calm a sproutling down (low health) or put it to sleep, then
  press **Befriend**. A 10-second game that fits its element wins its trust: follow the ripples (Water), grow the
  shoot to the sunlight (Wood), keep the ember kitten cosy (Fire), stack the clay pots (Earth), ring with the bell
  (Metal). Knock it out and it just runs home.
- **Team:** up to 6 travel with you (the first 3 fight); more wait at your house. Swap them at a shrine or at home.
- **Controls:** arrows/WASD to walk, Space to talk / continue, T for your team, or click/tap where to go (and on
  someone to talk to them). On a phone: a D-pad and a talk button. In battle, keys 1–4 pick a move.
- **Saving:** automatically, in the browser and (with a name) in Nook's cloud saves (game `sprout`), so you can carry
  on on another device. The games leaderboard shows shrines awakened, then kinds befriended.

## 2. How it works

- **Rules in one file:** `sprout.ts` (species, moves, the elements, levels, growing, battles and the computer's
  choices). Pure functions with a seeded random generator, like the other Arena games. The file exists twice,
  `api/src/arena/sprout.ts` and `web/features/arena/sprout/sprout.ts`, and a test fails if they differ: Stage 27's
  battles between people will run on the game server with exactly the same rules.
- **This stage runs in your browser** (no game server needed): adventure games with one player don't need one.
- **The island** is data (`island.ts`): each area is 12 rows of 20 characters (`#` tree, `~` water, `,` tall grass,
  `S` shrine, `K` keeper, `G` gate…). Tapping walks the shortest way there (breadth-first search).
- **Drawing:** the island with the Canvas 2D API (the map is painted once per area, then only what moves is drawn
  each frame); the sproutlings are SVG drawings in code (`Creature.tsx`), our own designs. No sprite files.
- **A battle on screen:** the rules play a whole turn at once and return what happened; the battle screen then tells
  it one step at a time ("Giọt used Splash!", the health bar going down, a little shake).

## 3. Balance

A bot plays the whole island (tested on several seeds): it befriends one sproutling per area and trains until its
team is about one level under the keeper. It beats every keeper, needing 6–20 wild battles per area. A team four
levels under a keeper loses almost always. For a person: roughly 1–1½ hours for the island.

## 4. Tests

- `api/tests/sprout.test.ts`: the two copies match; the Five Elements; levels, moves and growing; switching, speed
  order, fainting and forced switches; tames/guard/sleep; bench feeding; wild battles and befriending; the six maps
  (sizes, villagers, reachable keeper and shrine, gates); the island bot beats every keeper.
- `web/tests/sprout.test.tsx`: all 17 sproutlings draw; each element's befriending game starts; the pot game ends with
  a score. `web/tests/sprout-texts.test.ts`: every line on the island has Vietnamese.
- `web/e2e/stage26.spec.ts`: start, walk, open the team, save and continue.

Also in this stage: the sound helpers of Ngõ Pháo, Brawl and Mầm Thú no longer crash on a browser without Web Audio.

## What wasn't tested

- **A whole playthrough by a person** (the bot did it; tested by hand: the start, a wild battle and befriending,
  growing at a shrine, the third keeper's battle and its gate).
- **The pot and bell games by hand** (they start and the pot game ends with a score, in tests).
- **A real phone's thumbs** on the D-pad (checked in an iPhone-sized browser), and **sounds by ear**.
- The Vietnamese for the new texts was written by Claude.
