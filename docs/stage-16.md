# Stage 16 — Nook Games and Vân Lộ, a cultivation roguelite

**Goal:** a real game, not a mini-game: menus, a character that grows, saves that follow you between devices,
a world made fresh every run, and our own small game engine. Nook Games (`/games`) is the new app for bigger
games; its first game is **Vân Lộ (The Cloud Path)**, a turn-based cultivation (tu tiên) roguelite drawn in
ink-wash style.

The design (realms, methods, abilities, treasures, enemies, numbers) is in the Game Design Document, a doc you can
edit: https://claude.ai/artifact/QM1LQ8eTLMeMeV9j6h62Tu

## 1. Play it

Open **/games** (phone: **Apps → Games**) and pick **Vân Lộ**.

1. Choose a cultivator name and **test your spiritual root** (linh căn): 1–4 elements, rarer roots cultivate faster.
2. In your **cave abode** (động phủ): meditate with spirit stones, practise **công pháp**, choose **thần thông**,
   bind and refine **pháp bảo**, wear **equipment**, buy pills in the market.
3. **Enter the secret realm** Vụ Ẩn Cốc: 5 floors, a new map each time. Fight, pick herbs, open chests, take the
   stairs down, or step on a **return array** to go home with your loot. Fall, and the run's loot is lost (your
   cultivation stays).
4. At **Luyện Khí 9** with full cultivation: the **tribulation**. Dodge the lightning marked in gold for 15 turns,
   then defeat your Heart Demon, and you reach **Trúc Cơ**.

Keys: arrows/WASD (Q E Z C diagonal), Space wait, Enter stairs/portal, 1–9 action bar, Esc cancel.
Touch: tap next to you to step or attack, tap further away to walk there, tap yourself to wait.

## 2. How it's built

```
web/features/games/van-lo/
  engine/   rng.ts (seeded random) · grid.ts (tiles, lines) · fov.ts (field of view) · path.ts (A*, distances)
  logic/    data.ts (everything as data) · types.ts (the save) · player.ts (cultivation, methods, gear, treasures)
            realm.ts (map generation) · world.ts (a turn: you, enemies, the tribulation) · save.ts (checking saves)
  ui/       Board.tsx + draw.ts (canvas) · RunScreen.tsx · Home.tsx · VanLo.tsx · useGame.ts (state + saving)
api/src/routes/games.ts   cloud saves (table game_saves)
```

The rules (`engine/` and `logic/`) never draw anything and never touch the network, like Stage 14's quiz game.
They take a `Game` object, change it, and return what happened (`Fx`: hits, sword strokes, lightning). The screen
animates those. That split is what makes the game testable: `tests/vanlo.test.ts` plays turns without a browser.

### Turn-based, with a seeded random generator

There's no game loop for the rules: nothing happens until you act. `act(game, action)` does your action, then
every enemy's, then the sky's (in a tribulation). The only loop is the drawing loop (`requestAnimationFrame`), which
draws the current state 60 times a second and lets characters glide between tiles.

Every random thing (maps, damage, loot) comes from `makeRng()`, a small seeded generator (mulberry32). Its state is
part of the save, so **a loaded game continues exactly as it would have**. A test checks this: play 4 moves on a
game and on its saved copy, and both end up byte-for-byte the same.

### The engine pieces

- **Field of view** (`fov.ts`): "recursive shadowcasting". The view is split into 8 slices; each is scanned row by
  row, and walls cast shadows. What you've seen is remembered (`floor.seen`) and drawn faded.
- **Pathfinding** (`path.ts`): A* finds the shortest walk around walls; enemies use it to chase you, and so does
  "tap a tile to walk there". Diagonal steps may not cut wall corners.
- **Map generation** (`realm.ts`): rooms placed at random without overlapping, joined by L-shaped corridors plus a
  couple of loops; a breadth-first search puts the stairs in the room farthest from the start. A test builds
  floors from several seeds and checks that every floor tile can be reached.

### Drawing in ink

`draw.ts` paints with canvas paths only, no images: rice paper with grain, rocks as layered ink washes, characters
as brushy silhouettes with a red seal accent. The floor is painted **once** into an offscreen canvas and copied
every frame; only characters, mist and effects are redrawn. The canvas is sized for the screen's pixel density so
it stays sharp on phones.

### Saves on two sides

`useGame()` keeps the game and saves every change to `localStorage` straight away. If you have a name on Nook, it
also sends the save to `PUT /api/games/saves/van-lo` a few seconds later (and when you leave the page). On loading,
the newer of the two wins, so you can carry on from another device. `parseSave()` checks a save's shape before
trusting it. The API stores saves as JSON (`game_saves`, one per person and game, deleted with the person); saves
can be up to 200 KB, so this router reads JSON itself before the API's usual 10 KB limit.

Small fix on the way: a request that was too big used to get "500 Something went wrong"; the API now answers
**413 That's too big to send**.

## 3. Balancing with a bot

To check the numbers, a simple bot played 6 new characters (it fights what it sees, explores, drinks pills, flees
to the portal, and meditates and practises at home). It reached Trúc Cơ in 6–9 runs, fell 2–4 times on the way,
mostly on floors 3–4, and passed the tribulation first time. The Heart Demon was made tougher after that. Details
are in the design document.

## What wasn't tested

- Real phones (only Playwright's iPhone 13), and how it feels to play for an hour: the bot can't tell us that.
- The boss on floor 5 was never reached by the bot; it was only tested by the rules tests.
- No sound yet (Stage 17).
