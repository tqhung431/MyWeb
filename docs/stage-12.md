# Stage 12 — WatchList: data from other websites (and fixing song uploads)

**Goal:** use **public web APIs** from your own server: search them, combine two different answers into one
shape, cache what they return, and keep working when they're slow or down.

## 1. WatchList

Open **/watchlist** (on phones: **Apps → Watch**).

- **Find**: search TV shows and anime at once (or only one kind). Results show the year, kind, episodes and score.
- **My list**: *Want to watch*, *Watching*, *Watched*, *Dropped*; your stars (1–5), a short note, and an episode
  counter (+ / −; reaching the last episode marks it watched).
- **On Nook**: the most popular titles here this month (how many people, average stars, who) and the latest
  updates, live. Each title has a page with everyone's stars and notes.

| Source | What | Key? | Limits |
|---|---|---|---|
| [TVmaze](https://www.tvmaze.com/api) | TV shows | none | ~20 calls per 10 s |
| [Jikan](https://jikan.moe) | anime (MyAnimeList data) | none | 3 calls per second |

```mermaid
sequenceDiagram
    participant B as Browser
    participant A as API
    participant V as Valkey
    participant T as TVmaze
    participant J as Jikan
    B->>A: GET /api/watch/search?q=friends (450 ms after you stop typing)
    A->>V: asked today already? watch:search:tv:friends
    par both at once
        A->>T: /search/shows?q=friends
        A->>J: /anime?q=friends
    end
    A->>V: keep each answer for a day
    A-->>B: one list, TV and anime mixed, + which source didn't answer
    B->>A: PUT /api/watch/list/tv/431 { status: "watching" }
    A->>T: /shows/431 (Nook re-reads the title itself; the browser's copy isn't trusted)
    A->>A: save a copy in watch_titles, your entry in watch_entries
```

What it teaches:

- **One shape for two APIs** (`api/src/watch/sources.ts`): TVmaze's `name`, `premiered`, `rating.average` and
  Jikan's `title_english`, `year`, `score` both become `{ title, year, rating, kind, … }`. Summaries arrive as HTML
  and are turned into plain text.
- **Calling two things at once** with `Promise.allSettled`: if one is down you still get the other, and a note
  ("Anime search isn't answering right now").
- **Caching** (Stage 5 again): the same search is asked once a day, which keeps Nook fast and polite to free services.
- **Your own copy**: a title someone saved is stored in Nook, so lists still work when TVmaze or Jikan is down.
  Titles nobody has on a list any more are removed by the daily clean-up.
- **Debounce**: the search waits until you stop typing for 450 ms, so "frieren" is one request, not seven.

The PC running Nook needs the internet to search; posters load from TVmaze's and MyAnimeList's image servers.

## 2. Song uploads fixed

| Problem | Cause | Fix |
|---|---|---|
| Many songs said "Can't reach Nook" | When Next.js passes `/api/*` on to the API (port 3000 and `npm run dev`), it keeps only the **first 10 MB** of a request. Bigger songs were cut off; the API waited for the rest and gave up after 30 s | `experimental.proxyClientMaxBodySize` in `web/next.config.ts`, set from `MAX_UPLOAD_MB` |
| Adding a whole collection failed after 30 songs | The hourly limit (30) answered **before** the file had arrived, so the browser saw a dropped connection, not the message | The limit is checked after the upload; 300 songs an hour; a clear message ("Try the rest in about 40 min") |
| "Đêm Nay 🎵.mp3" became "ÄÃªm Nay ðµ" | The upload library reads file names as Latin-1 unless told otherwise | `defParamCharset: "utf8"`, and names are normalised (a Mac's "e + ◌̂" becomes "ê") |
| FLAC/WAV songs refused | 30 MB limit | 100 MB (`MAX_UPLOAD_MB` in `.env`) |

The upload page also flags too-big files before sending them, tries again twice when a connection drops, and
shows "40 of 42 added · 2 with a problem".

## 3. Also

- The phone tab bar has more apps than fit: it now shows **Home, Chill, Music, Hobbies** and **Apps**, a grid of
  every app (and You). Which apps are on the bar is `pinned: true` in `web/lib/apps.ts`.

## 4. Tests

- API: search in one shape, HTML removed, the cache (one call for the same words), one source down, adding /
  updating / removing, bad input, working from Nook's own copy when a source is down, popular on Nook, clean-up
  (`watch.test.ts`, against a fake TVmaze and Jikan in `tests/fake-watch.ts`; the TVmaze answer is a real sample).
  Uploads: Unicode and Mac file names, the hourly limit (`music.test.ts`).
- Tried in Chromium with two people (desktop + iPhone 13) against the **real TVmaze**, and an upload of 42 songs
  with Vietnamese and emoji names through the website.
- **Not tested live:** Jikan (anime). It couldn't be reached from the development sandbox, so anime search was only
  tested against the fake. Try searching an anime on your PC. Posters were blocked in the sandbox too.

## Files

```
api/src/watch/sources.ts        TVmaze + Jikan → one shape, cached
api/src/routes/watch.ts         search, your list, on Nook, title page
api/drizzle/0011_watchlist.sql  watch_titles, watch_entries
web/features/watch/             Find, My list, On Nook, title page
api/src/routes/music.ts · web/next.config.ts · web/features/music/AddSongForm.tsx   the upload fixes
```
