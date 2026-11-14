# Stage 30 — One Games app, in your language

**Goal:** the owner's remarks: four places to play (Mini Arcade, Arcade Online, Nook Arena, Nook Games) with shortcuts to
each other, and games that still showed Vietnamese names (monsters, classes, sproutlings) when Nook was in English.

## 1. One Games app

The sidebar, the phone's "Apps" grid and Home now have **one Games entry**. Its tabs:

| Tab | What's there | Address (unchanged) |
| --- | --- | --- |
| All games | every game once: Adventures, Together (live), Party, Quick games | `/games` |
| Quick games | the six Mini Arcade games | `/arcade` |
| Party | Quiz Party | `/arcade-online` |
| Together | Firecracker Alley, Keep the Village, Night Market Brawl, Chess, and the game server's status | `/arena` |
| Adventures | Cloud Path and Sproutlings (games with saves) | `/games/adventures` |
| Leaderboards | **every** leaderboard in one page: pick a game (the address remembers it, e.g. `#chess`) | `/games/leaderboards` |

- **Old addresses keep working.** The games keep their own addresses, so bookmarks, saves and scores don't move.
  `/arcade/scores` and `/arcade-online/leaderboard` now open the one Leaderboards page.
- **Listen Together** moved to **Music** (it's about songs). **Nook TV** stays its own app.
- The menus know which app a page belongs to by its address: `appForPath()` in `web/lib/apps.ts` (the longest
  address wins, so `/arena/listen` is Music and `/arena/chess` is Games). A tab can light up for other addresses
  too (`match`), so Sproutlings (`/arena/sprout`) shows under Adventures.
- Every game has one card, drawn once in `web/features/games/GameCards.tsx` and used by every Games page.

## 2. Games speak Nook's language

| Before (in English) | Now in English | In Vietnamese |
| --- | --- | --- |
| Ngõ Pháo | Firecracker Alley | Ngõ Pháo |
| Giữ Làng | Keep the Village | Giữ Làng |
| Chợ Đêm Brawl | Night Market Brawl | Chợ Đêm Brawl |
| Mầm Thú | Sproutlings | Mầm Thú |
| Vân Lộ | **Cloud Path** | **Vân Lộ** (never "Đường Mây") |
| Giọt, Mầm Tre, Than Hồng, Gốm, Chuông Nhỏ… | Droplet, Shootling, Emberkit, Potsy, Tinkle… (all 17) | Giọt, Mầm Tre… |
| Làng Chài, Rừng Tre… (areas) | Fishing Village, Bamboo Grove… | Làng Chài, Rừng Tre… |
| Thanh Khê island | Clearwater Isle | đảo Thanh Khê |
| bots Bé Pháo, Kẹo Dừa… | Bobo, Kiki, Momo, Lulu (same in both) | |

- **Cloud Path follows Nook's language** (Settings → Language). Its own language switch is gone, and an old save
  that started in Vietnamese now shows English when Nook is in English. Its classes, realms, monsters and items
  already had both languages.
- **People's names stay** (Cô Mai, Bác Tư…): they're names, not words. **Dishes stay** too (bánh mì, chè, bánh xèo),
  like "sushi" in English.
- The sproutlings' English names live in `web/features/arena/sprout/names.ts` (`SPECIES_NAMES`, shown with
  `t()`); the rules file `sprout.ts` (two byte-identical copies) didn't change.

## 3. Updating your Nook

```bash
git pull
docker compose up -d --build
```

No database changes.

## 4. Tests

- `web/e2e/stage30.spec.ts`: twelve game pages in English have **no Vietnamese letters** (dishes allowed); one Games
  entry in the menu and its tabs reach every game; old leaderboard addresses open the one page; Listen Together is in Music.
- Updated: Firecracker Alley's bot names (API and e2e), the app registry test, Quiz Party's "Games played" column.

## What wasn't tested

- Every screen *inside* each game (the e2e test checks each game's front page; I looked at Cloud Path's cave abode
  and the Sproutlings home in English).
- Quiz Party's questions are still English only, in both languages.
- A real phone (tested in an iPhone-sized browser). The Vietnamese for the new texts was written by Claude.
