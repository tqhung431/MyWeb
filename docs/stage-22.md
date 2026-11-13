# Stage 22 — Nook Arena: a game server, live chess, Listen Together and Nook TV

**Goal:** a game server of Nook's own, so people can play and listen *together*, live. On top of it: chess
(against each other or against Nook), Listen Together (one song, same second, for everyone in the room) and
Nook TV (YouTube videos the admin picks, plus live screen sharing).

Design: "Stage 22 design: Nook Arena games" (Claude Docs) and the Figma file "Nook design system", page
*Stage 22 – Nook Arena*. This stage builds the first part of that plan; the action games come in Stages 23–27.

## 1. What's new

| App | Where | What you can do |
| --- | --- | --- |
| **Nook Arena** | `/arena` | The hub: Chess, Listen Together, Nook TV, and what's coming next |
| **Chess** | `/arena/chess` | Play someone live (4-letter room code or link, 5/10/15+10 min or no clock, ratings), play **Nook** (the computer, 4 levels, in your browser, works offline), or two people on one screen. Replay any finished game, download it as PGN |
| **Listen Together** | `/arena/listen` | Start a room, add songs from Nook's Music library, heart what should play next, skip (or vote to skip), react with emoji. Everyone hears the same second |
| **Nook TV** | `/tv` | Shelves of YouTube videos and playlists. Only the **admin** adds or removes them; everyone watches. The admin can also **share a browser tab** live |
| **Admin** | `/settings` → Admin | Type the admin passcode once on your browser to become the admin |

## 2. The game server

```
 phone / PC ──WebSocket──► Caddy ──/api/arena──► arena  (Socket.IO, port 4100)  ──► PostgreSQL (results only)
                                  └─/api/*──────► api    (everything else)
```

- **Its own program** (`api/src/arena.ts`, Docker service `arena`): same code and database as the API, but a
  busy game never slows down the rest of Nook, and it can be restarted on its own.
- **The server is the referee.** Rooms, the chess position and the clocks live in the server's memory. Browsers
  send "I want to move e2→e4"; the server checks it with the same rules (chess.js) and tells everyone the new
  position. A browser can't cheat by editing its own page.
- **Rooms** have 4-letter codes (no I or O, easy to read out). An empty room closes after 5 minutes.
- Only **results** go into the database: `chess_games` (the moves as PGN, the result, why) and `arena_ratings`.
- The rules are plain functions with no network code (`arena/chess-game.ts`, `arena/listen.ts`), so tests run
  them with a fake clock, like Quiz Party (Stage 14).
- Who you are: the same `nook_session` cookie as the rest of Nook. Guests can watch; playing needs a name.

## 3. Chess

- **Clocks** run on the server. Your page counts down smoothly between updates using the server's time, so a
  phone whose clock is off still shows the right time. Run out and you lose, unless the other side has only a
  king left (then it's a draw, the usual rule).
- **Gone for 2 minutes** in the middle of a game (closed the tab, lost Wi-Fi) = you lose. Coming back sooner is fine.
- **Ratings (Elo)**: everyone starts at 1200. Beat someone rated higher and you gain more than if you beat
  someone lower. Only live games count.
- **Nook, the computer** (`web/features/arena/chess/engine.ts`) thinks in a Web Worker so the page never freezes:
  - its own small, fast board (chess.js knows the rules but checks only a few thousand positions a second);
  - looks ahead 1–4 moves, skipping lines that can't matter (alpha-beta), and keeps looking at captures at the
    end of a line so it doesn't stop mid-trade;
  - lower levels add random noise to their judgement, so they make human-looking mistakes;
  - tested against the standard "perft" numbers that every correct chess program must reproduce.
  - Levels: Sprout, Walker, Climber, Summit. Level 4 thinks about a second per move on a laptop.
- Pieces and board are drawn in code (SVG), our own design. Tap-tap or drag to move; promotion asks which piece.

## 4. Listen Together

The trick to "same second": the server doesn't stream audio. It says *"song 12 started at server time T"*
(or *"paused at second 48"*). Each browser:

1. measures how far its clock is from the server's (4 quick pings; half the round trip is the travel time),
2. works out where the song should be *now*,
3. jumps the `<audio>` there only if it's more than a third of a second off (so you don't hear stutters),
4. checks again every second.

Join late and you start mid-song, in step. The queue is ordered by hearts. With **Everyone can pause and skip**
off, only the host controls the music and the others vote to skip (more than half wins). The song files come
from Music (Stage 7), so they're on your network already. Nook's own music player stops while you're in a room.

## 5. Nook TV and the admin

**Admin passcode.** Put a long passcode in `.env` and restart:

```
ADMIN_PASSCODE=pick-something-long-here
```

Then on your browser: **Settings → Admin → Become admin**. Being admin is remembered for that browser (the
session), not for your name, so the passcode is needed again on another phone. Empty passcode = nobody can be admin.
Wrong guesses are limited (10 per 15 minutes).

**Videos.** The admin pastes YouTube links (videos, Shorts, playlists) and names a shelf ("Cartoons", "Music").
Nook asks YouTube for the title. The player is YouTube's own, from `youtube-nocookie.com` (no YouTube cookies
until you press play). Nook stores only the link and the title.

**Screen sharing.** The admin opens **Nook TV → Live → Start sharing**, picks a browser tab and ticks "Share
tab audio". Everyone else sees **Live now** on Nook TV. The video goes **straight from the admin's browser to
each viewer** (WebRTC); the game server only passes along the short "how do I reach you" messages. That works on
your home network (and over Tailscale) with no outside server. It needs Chrome, Edge or Firefox on a computer
to share; any phone can watch.

What Nook TV doesn't do: it has no links or presets for other sites. What the admin shares in their own tab is
their choice and their responsibility.

## 6. What it needs from the PC

Stage 22 adds one small service (`arena`): about 60–100 MB of memory, almost no CPU when idle. Chess and Listen
Together send tiny messages; the songs come from the same disk as before. Screen sharing costs the **admin's**
PC the upload (about 2–4 Mbit/s per viewer), not the Nook server. The planned action games (Stages 23–27) will
use more: see the design doc for those numbers.

## 7. For developers

```bash
cd api && npm run arena        # the game server on :4100 (next to npm run dev and npm run worker)
```

`next.config.ts` forwards `/api/arena` to it (`ARENA_URL`, default `http://127.0.0.1:4100`); in Docker, Caddy does
(`ARENA_UPSTREAM`). New API routes (not under `/api/arena`, which Caddy sends to the game server): `/api/admin`,
`/api/tv`, `/api/chess/*`, all in `/developers`.

Events (Socket.IO, path `/api/arena`; every call answers with `{ ok, error? }`):

| Event | What |
| --- | --- |
| `time` | the server's clock, for Listen Together |
| `arena:rooms {kind}` | open rooms; the server also announces `arena:rooms` when they change |
| `room:join` / `room:leave {code}` | enter or leave; the server sends `room:state` to the room on every change |
| `chess:create {timeControl, color}` · `chess:move {code, from, to, promotion?}` · `chess:resign` · `chess:draw` · `chess:decline` · `chess:rematch` | chess |
| `listen:create {name}` · `listen:add {songId}` · `listen:vote {key}` · `listen:remove {key}` · `listen:skip` · `listen:pause` · `listen:resume` · `listen:seek {seconds}` · `listen:ended {key}` · `listen:everyone {on}` · `listen:react {emoji}` | Listen Together |
| `tv:status` · `tv:share` · `tv:stop` · `tv:watch` · `tv:signal {to, data}` | screen sharing (`tv:share` is admin only; signals pass only between the sharer and a viewer) |

## If Nook Arena says it can't reach the game server

The game server is a separate service (`arena`) that came with Stage 22. On a server that was set up earlier:

```bash
git pull
docker compose up -d --build        # builds and starts the new "arena" service too
docker compose ps arena             # should say: running (healthy)
docker compose logs arena           # if not: why it stopped
```

Then check the whole way from outside (replace the address with yours):

```bash
curl "https://nook.example.com/api/arena?EIO=4&transport=polling"
# good: 0{"sid":"…","upgrades":["websocket"],…}
```

- **Cloudflare tunnel or Cloudflare Access:** nothing extra; `/api/arena` goes through Caddy like the rest of `/api`.
  Behind Cloudflare Access, open Nook once in the browser first, so it has the Access pass. A `curl` without it gets the
  "Nook is private" page (that's correct).
- **Cloudflare proxy (orange cloud) or nginx:** WebSockets must be allowed (Cloudflare: Network → WebSockets on;
  `deploy/nginx/nook.conf` already passes them). Without WebSockets the games still work, a little slower.
- **A custom tunnel or proxy that sends only some paths to Nook:** send everything (`/`) to Caddy, or at least add
  `/api/arena`.

## 8. Tests

- `api/tests/arena-rules.test.ts`: chess rules with clocks (increment, flag, insufficient material), draws,
  Elo; Listen Together queue, votes, pause/seek maths, late "song ended" messages.
- `api/tests/arena.test.ts`: the real game server over Socket.IO: a full game to checkmate saved with ratings
  and a live-feed line, rematch with colours swapped, flag on time, abandonment, guests can only watch; a Listen
  Together room in step; the admin passcode; Nook TV add/rename/remove (admin only); screen-share signalling
  can't be used viewer-to-viewer; games against Nook are checked and don't change ratings.
- `web/tests/chess-engine.test.ts`: perft counts (start position, "Kiwipete", en passant, promotions), mate in
  one at every level, legal moves through a whole game, speed.
- `web/e2e/stage22.spec.ts`: two browsers play a live game to checkmate; Nook answers a move.

## What wasn't tested

- **Screen sharing with a real tab.** Headless Chrome has no "choose a tab" window, so the test shared a drawn,
  moving picture instead. Everything after that (the connection between the two browsers, video arriving on a
  phone-sized viewer, "stop" reaching the viewer) was tested for real. Try it once on your PC with a second device.
- **Sound in Listen Together** was checked by the position of each browser's player (0.2 s apart), not by ear.
- **Nook TV thumbnails and titles from YouTube**: the sandbox can't reach YouTube, so cards showed without
  pictures and titles came from the test. On your network they come from YouTube.
- **Through a Cloudflare tunnel**, screen sharing may not connect (no relay server); on your network and over
  Tailscale it should.
- The Vietnamese for the new texts was written by Claude.
