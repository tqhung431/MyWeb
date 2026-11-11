# Stage 17 — Vân Lộ grows: six paths, realms up to Nguyên Anh, the furnace, music

**Goal:** turn the first playable into a whole game. Every path from the plan gets its own way to play, the climb goes
on to Nguyên Anh with three new secret realms, the herbs and ores you find become pills and gear in a furnace, and the
game gets its own music and sound effects. The design document is updated with all the numbers:
https://claude.ai/artifact/QM1LQ8eTLMeMeV9j6h62Tu

## 1. Six paths

Pick one when you start a new cultivator. Stage 16 saves continue as Kiếm tu.

| Path | Plays like | Its resource (0–10) |
| --- | --- | --- |
| **Kiếm tu** | Damage, flying swords | **Kiếm ý**: +1 per hit; +3% damage per point |
| **Võ giả** | Tough body, counter-attacks | **Khí huyết**: +2 when hit, +1 when hitting; +2% defence per point; 20% counter |
| **Nho gia** | Written words that bind and guard | **Chính khí**: +1 every turn; −2.5% damage taken per point |
| **Đạo gia** | Fire talismans, thunder, trapping formations | **Đạo vận**: +1 per ability; +3% ability power per point |
| **Phật gia** | Healing, golden bell, karma | **Công đức**: +1 per defeat or heal; reflects 2% per point |
| **Binh gia** | Summons soldiers and archers | **Quân lệnh**: +1 every 2 turns; +5% to soldiers per point |

Kiếm tu keeps its 3 methods and 8 abilities; every other path has 2 methods and 4 abilities, and its own starting
treasure (11 treasures in all). Each path also has a "spend it all" finisher that uses the whole resource.

### Abilities are data now

In Stage 16 each ability had its own code in a big `switch`. With 28 abilities and 11 treasures that doesn't scale, so
every ability and treasure power is now described with the same few fields (`Effect` in `logic/paths.ts`):

```ts
"ngu-loi": ab("Ngũ Lôi Chính Pháp", "Five Thunders Rite", ["ngu-hanh", 3], 10, 4,
  { target: "area", range: 5, radius: 1, mult: 1.1, enemy: [{ kind: "stun", turns: 1 }] }, …)
```

…and one function, `applyEffect()` in `logic/world.ts`, carries them all out: who's hit (`self`, `around`, `line`,
`enemy`, `adjacent`, `area`, `dash`), how hard (`mult`, `perPoint` with `spendAll`), what it leaves behind (burn, stun,
weak), what it does for you (heal, qi, shield, reflect, block, empower), and summons. It checks the target first and
changes nothing if it's wrong. A test uses every ability of every path, and every treasure, in a real fight.

### Soldiers

Binh gia's soldiers and archers (`Ally` in `types.ts`) take their turn after you: shoot or strike the nearest enemy
they can see, walk towards it with A*, or follow you. Enemies go for whichever is closer, you or a soldier. You can
swap places with your own soldiers. They last 25 turns.

## 2. Realms up to Nguyên Anh

| Realm | Secret realm | Floors | Enemy levels | Danger on the ground | Boss |
| --- | --- | --- | --- | --- | --- |
| Luyện Khí | Vụ Ẩn Cốc | 5 | 1–10 | hidden killing arrays | Xích Giác Mãng Vương |
| Trúc Cơ | Lưu Hỏa Nham Quật | 6 | 10–22 | lava pools (burn) | Viêm Giáp Thú Vương |
| Kết Đan | Bích Hải Di Tích | 7 | 19–33 | whirlpools (sweep you away) | Bích Lân Giao |
| Nguyên Anh | Cổ Chiến Trường | 7 | 28–42 | grudge miasma (drains qi) | Tàn Hồn Ma Tướng |

Each realm has its own herb, enemies (16 new ones) and paper tint. Each boss drops the pill for the next tribulation.
Tribulations get longer and denser at each step (15, 18, 21 turns).

**One growth curve for everything.** Past Luyện Khí, player stats, enemy stats and gear all grow by about ×1.12 per
level (`curve()` in `data.ts`), with an extra jump at each breakthrough. Because both sides follow the same curve, a
cultivator fighting enemies of their own level hits about as hard at Nguyên Anh as at Trúc Cơ, and a test checks that.
Method and treasure bonuses grow with your realm too, so they still matter late; ability qi costs rise with each major
realm because your qi pool does.

## 3. The furnace (lò luyện)

A new tab in the cave abode (`logic/craft.ts`):

- **Luyện đan (alchemy):** herbs + beast cores → pills, including the tribulation pills. It can fail (55% at first,
  +8% per skill level); failing burns the materials.
- **Luyện khí (forging):** 2 dark iron → a new piece of gear in the slot you choose, one level above you. Skill pushes
  the quality up.
- **Chế phù (talismans):** talisman paper → Burst and Return talismans.

Each craft gives experience; levels come after 3, 5, 7… crafts. Herbs from secret realms now go into your bag as
materials (and still heal a little and give tu vi).

## 4. Music and sound

`ui/audio.ts` makes everything live with the Web Audio API, like Chill Corner: no recordings, nothing to license.

- **Music:** a plucked-string melody (a triangle wave with a quick bend into each note and a fading low-pass filter,
  close to a guzheng) that wanders up and down a pentatonic scale over a soft drone. Gong mode at home, a darker yu mode
  in secret realms, and drums in a tribulation. Notes are scheduled a little ahead on the audio clock, so timing stays
  steady even when the page is busy.
- **Effects:** sword strokes (filtered noise), hits, lightning, healing, pickups, the furnace, and a temple gong for
  breakthroughs (a few out-of-tune sine partials ringing for 4 seconds).
- Music and sound can be turned off at the bottom of the cave abode; the choice is saved in the browser.

## 5. Balancing with a bot, again

The bot from Stage 16 now plays every path from Luyện Khí 1, entering the newest realm it can, buying pills,
practising, equipping better gear and meditating. With the final numbers:

| Path | Runs to Nguyên Anh 9 | Defeats on the way |
| --- | --- | --- |
| Đạo gia | 28 | 16 |
| Phật gia | 36 | 23 |
| Binh gia | 37 | 13 |
| Võ giả | 41 | 18 |
| Kiếm tu | 46 | 22 |
| Nho gia | 48 | 10 |

Before tuning, the spread was 21–63 runs and Trúc Cơ alone took up to 33 runs. Layer costs were changed so each
realm takes a similar share, Nho gia was made stronger and Đạo gia a little weaker. The bot isn't equally clever with
every path (it uses abilities in a simple order), so treat these as rough. The bot passed every tribulation; people
may find them harder.

## 6. Saves

The save format is now version 2: a path, crafting skills, gear levels. Stage 16 (version 1) saves are upgraded when
loaded (`upgradeFromV1()` in `save.ts`): they become Kiếm tu, old jade-slip names are renamed, gear gets a level. A test
loads a version 1 save.

## What wasn't tested

- How the music and effects actually sound: the sandbox has no speakers. The code runs without errors.
- Real phones (only Playwright's iPhone 13), and an hour of real play for each path.
- Balance beyond the bot.
