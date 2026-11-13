# Stage 23 — Ngõ Pháo (Firecracker Alley)

**Goal:** the first real-time game on Nook's game server (Stage 22): a party maze for 2–4 people, bots in the
empty seats, drawn with PixiJS at the screen's full frame rate, in our own 2D anime style.

Where: **Nook Arena → Ngõ Pháo** (`/arena/alley`). Design: "Stage 22 design: Nook Arena games" (Claude Docs).

## 1. The game

- Everyone is a round **lantern-head** in a 13 × 11 alley at Tết. Pick a colour (red, jade, gold, violet) and a hat
  (leaf hat, cat ears, ribbon, dragon horns).
- **Drop a firecracker** (Space, or the big button): it pops after 2.5 s in a cross of sparks. Sparks break
  bamboo crates and knock out anyone they touch, you included.
- **Crates hide power-ups:** 🧨 one more firecracker at a time · 🔥 longer sparks · 👟 faster feet ·
  kick (walk into a firecracker to send it sliding) · a shield that takes one hit.
- **Knocked out?** You're a little ghost: float anywhere, and drop a tiny cracker every 10 s. It doesn't knock
  anyone out, it only stuns them for a moment.
- **A lion dance** passes once a round and pushes people out of its row.
- **No endless rounds:** after 90 s, lanterns fill the alley from the edges, one ring every 3.5 s.
- Last one standing wins the round; **first to 3 rounds wins the match**. Then awards: Most crates, Sharpest aim,
  Collector, Tripped on own cracker, Pesky ghost.
- **Maps:** Old Town (houses), Market (stalls), Rooftops (chimneys). Crates are scattered anew each round; the
  corners where people start are always clear.
- **Rooms:** start one, share the 4-letter code. The host picks bots (0–3) and the map; everyone else presses
  "I'm ready". Wins go on the "Most matches won" board.

## 2. How it works

```
 browser ── "I'm walking right" / "drop" ──►  game server: the rules, 20 times a second  ──► everyone: the match
   ▲                                          (api/src/arena/alley.ts)                        (alley:tick)
   └── PixiJS draws 60–120 frames a second, smoothly between the server's updates
```

- **The rules** (`api/src/arena/alley.ts`) are plain functions with the time passed in and a seeded random
  generator: tests play whole matches with a fake clock in well under a second.
- **The server is the referee.** Browsers only send a direction (when it changes) and "drop". The server moves
  everyone, times the fuses, breaks crates and decides who's out.
- **Smooth on screen:** other players are drawn 100 ms in the past, sliding between two server updates
  ("interpolation"). Your own character moves the moment you press, using **the same walking code** as the
  server (`alley-move.ts`, kept in two identical copies; a test fails if they differ), and is corrected gently
  if the server disagrees ("prediction").
- **Bots** look at a danger map (where sparks will be, and when), run to safety first, drop a firecracker only
  when they can still escape, then go for power-ups, crates and people. They think 10 times a second.
- **Left mid-match?** A bot plays for you until you're back.
- **PixiJS** (MIT licence) draws with WebGL. All pictures are drawn in code once and turned into textures
  (`art.ts`); sprites reuse them, so each frame is cheap. PixiJS loads only when a match starts, so the other
  pages stay small. Sounds are made with the Web Audio API (`sound.ts`), no files.

Messages: `alley:create`, `room:join`, `alley:look {color, hat}`, `alley:ready`, `alley:settings {bots, map}`,
`alley:start`, `alley:input {dir}`, `alley:drop`, `alley:again`; the server sends `room:state` (the room) and
`alley:tick` (the match: positions, firecrackers, sparks, tiles, events for sounds and little explosions).
Updates may be dropped if a phone falls behind: the next one, 50 ms later, has everything.

## 3. What it costs

- **Server:** a match takes about 1 ms of work per update. Several rooms at once are no problem for a home PC.
- **Network:** about 1 KB per update, 20 a second: ~20 KB/s per player. Fine on Wi-Fi and over Tailscale.
- **Phone:** the game's drawing code (PixiJS and the renderer) is about 500 KB before compression, loaded only when a
  match starts.

## 4. Tests

- `api/tests/alley-rules.test.ts`: the maps (sizes, everything reachable, corners clear), walking and corners,
  firecrackers (timing, walls, crates, chains, can't walk back onto one, kicks, shield), ghosts' tiny crackers,
  the lantern rings, the lion, a whole bot match with awards, and "bots don't throw rounds away".
- `api/tests/arena.test.ts`: a room over the real game server: colours, host-only settings, ready, start with a
  bot, steering moves you, a bot takes over when you leave, the result saved on the leaderboard.
- `web/e2e/stage23.spec.ts`: start a room in a browser, play with 3 bots.

## What wasn't tested

- **Frame rate on real hardware.** The sandbox has no graphics chip; Chrome emulates one in software and reached
  30–38 frames a second there, while the game's own code took only about 1 ms per frame (production build).
  On a real phone or PC the graphics chip does the drawing, so 60+ is expected, but it hasn't been measured on one
  yet. The frame rate shows under the alley ("· 60 fps") so you can check.
- **Touch controls** were laid out for phones and checked at iPhone size, but not played with fingers.
- **Sounds** were not listened to.
- **Two real people on two devices** haven't played over the network yet; the server test plays two people
  through Socket.IO in one process.
