# Stage 18 — Vân Lộ comes alive: sprites, smooth movement, living floors, a leaderboard

**Goal:** make Vân Lộ feel like a modern action roguelite (the smooth, busy feel of games like Soul Knight) while keeping
its turn-based rules. Each path gets its own look, you can hold a direction to keep walking, floors are full of things
to smash and find, there's a leaderboard for everyone on Nook, and the game runs on older phones too.

Also in this stage: two bug fixes (Music showed only 50 songs; light text on light boxes in dark mode), and a clean-up of
the repository (licence, README, credits).

## 1. Sprites: six paths, six looks

`web/features/games/van-lo/ui/sprites.ts` is a sprite library drawn entirely in code, like the rest of the game (no image
files, so nothing to license and nothing to download).

| Path | Look |
| --- | --- |
| Kiếm tu | white robe, blue trim, hair ribbon, a sword |
| Võ giả | bare arms, leather vest, red headband, fists and wraps |
| Nho gia | green scholar's robe, black cap, a brush |
| Đạo gia | purple robe with a taiji, crown, beard, a horsetail whisk and a talisman |
| Phật gia | saffron robe, shaved head, a halo, a ringed staff |
| Binh gia | armour plates, a plumed helmet, a red cape, a spear |

Each hero has 4 **poses** (idle 2 frames, walk 4, attack 3, hurt 1), faces left or right, and shows its **realm**: a
ring at Trúc Cơ, a golden core at Kết Đan, a small floating spirit at Nguyên Anh.

### Why a cache?

Drawing a hero means dozens of canvas paths. Doing that 60 times a second for every character is slow on a phone. So each
picture is drawn **once** into a small offscreen canvas, keyed by everything that changes it:

```ts
cached(`hero:${path}:${major}:${pose}:${frame}:${facing}:${dark}:${size}`, w, h, (g) => drawHero(...))
```

After that, each frame only *copies* the picture (`drawImage`), which the browser does very fast. The cache keeps at most
600 pictures. A white "hit flash" of any sprite is made the same way, with the `source-in` composite mode.

### The asset gallery

`/games/van-lo/assets` shows every sprite animated: the 6 heroes in each pose and realm, all 23 monsters and bosses, the 2 kinds of soldiers,
19 props, and each realm's "air" (particles). There's a link at the bottom of Vân Lộ ("Art gallery").

## 2. Smooth movement

- **Hold to walk**: hold an arrow key (or WASD) and you keep walking, one step every 150 ms. Hold two arrows to walk
  diagonally. The browser's own key repeat is ignored (`e.repeat`), so the pace is the same on every computer.
- **Joystick** on phones and tablets (only on touch screens: `matchMedia("(pointer: coarse)")`): push the knob, it
  picks one of 8 directions by angle; a small push does nothing.
- Characters still **glide** between tiles; now the hero also plays its walk frames, turns to face where it goes, and
  **lunges** at the enemy when it attacks.

The rules are still turn-based: holding a key just sends one "move" action after another.

## 3. Juice: particles, shake, light

`ui/particles.ts` is a small particle system: a fixed-size pool (old particles are dropped when full), positions in tiles
so they don't slide when the camera moves, and four shapes (dot, shard, spark, glow).

| When | What you see |
| --- | --- |
| you step | a puff of dust |
| a hit | sparks (red when it's you), the enemy shakes and flashes white |
| a critical hit, lightning, getting hurt | the screen shakes a little |
| an urn or crate breaks | shards that fall with gravity |
| a heal, a shrine blessing | rising motes of light |
| torches and campfires | sparks |
| each realm | its own air: fireflies, embers, bubbles, ash; falling sparks in a tribulation |

**Lighting** (dark mode): the screen is covered by a dark layer with soft holes cut out (`destination-out` radial
gradients) around you and every torch, lantern, crystal and shrine you've found, flickering a little.

**Softer mist**: the mist is now a tiny canvas with *one pixel per tile*, stretched over the map with smoothing on. It's
rebuilt only when what you can see changes, not every frame (Stage 17 filled hundreds of rectangles every frame).

## 4. Living floors

| Thing | What it does |
| --- | --- |
| **Urns and crates** (3–6 per floor) | stand in your way; walk into one to smash it (takes a turn). Most hold spirit stones, a herb or a pill |
| **Shrines** (40% of floors) | step on to pray once: +25% attack, or −25% damage taken, or 3% life back each turn (30 turns), or stones and full qi |
| **Wandering merchant** (35% of floors from floor 2) | walk into them to open a shop with 3 goods, a little dearer than at home. You pay with stones from this trip first, then the ones you brought. Buying takes no turn |
| **Decorations** (up to 18 per floor) | torches, lanterns, statues, banners, bones, crystals, coral… each realm has its own set, always next to walls |

Urns, crates and merchants **block** everyone: enemies, soldiers, dashes, whirlpools. Blessings end when you go down
the stairs. A test builds floors from many seeds and checks that the stairs can always be reached even when the merchant
never moves (urns can always be smashed).

## 5. Bảng phong vân: the cultivation leaderboard

A new "Ranking" tab. When Vân Lộ saves to Nook, it also sends `board: { path, level, kills }`, stored in 3 new columns of
`game_saves` (migration `0015_game_leaderboard`), with an index on `(game, level)`.

`GET /api/games/leaderboard/van-lo` returns the top 20: highest realm first, then most kills, then whoever got there first.
Only people who picked a name are on it (guests save only in their browser).

## 6. Older phones: light effects

A button under the map switches between **full** and **light** effects. Light effects:

- draw at 1× pixel density instead of 2× (a quarter of the pixels),
- keep at most 90 particles (instead of 420) and no realm air,
- no lighting layer,
- 30 frames a second instead of 60.

It's on by default for devices with 2 cores or less, 2 GB of memory or less, or "reduce motion" turned on. The game also
measures the first 3 seconds: if frames take more than 30 ms on average, it switches to light effects and tells you.
Your choice is remembered in the browser.

## 7. Balance between paths

A throwaway bot plays each path from Luyện Khí 1 to Nguyên Anh 9 on several seeds (it is deleted after use, so the numbers
don't become a test that blocks future changes). Changes: Nho gia's chính khí now also adds 3% ability power per point, its
methods give more attack and its brushstroke hits harder; Đạo gia's đạo vận goes from +3% to +2.5% per point; Võ giả and
Binh gia methods got a little more attack or life.

The bot is simple (it walks to the nearest enemy and uses abilities in order), so real players will see different numbers.

## 8. The two fixes

- **Music showed only 50 songs.** The charts endpoint had a fixed `LIMIT 50`. It now takes `limit` (up to 500, default
  100), `offset` and `q` (search title and artist), and sends the total in an `X-Total-Count` header. The Music page
  has a search box and a "Show more songs" button.
- **Light text on light boxes in dark mode.** A section with its own palette (`data-palette="ink"` on the Vân Lộ cards)
  stayed light while the text followed dark mode. Palette sections now follow the page's light/dark mode and set their own
  text colour; the white buttons on Arcade Online and Mini Arcade got a `light` button variant with dark text. A script
  checked every page in all 6 palettes in dark mode.

## 9. Clean-up

- `LICENSE`: MIT for Nook's code. Songs and other content keep their own licences (see `CREDITS.md`).
- README: features list includes Nook Games, the stage list goes to 18.
- The old hand-drawn player figure (replaced by sprites) was removed from `draw.ts`.

## What wasn't tested

- Real phones: the joystick and light effects were checked in a Playwright iPhone 13 emulation, not on a device.
- The frame-time check that turns on light effects can't be tested in the sandbox (no slow GPU there).
