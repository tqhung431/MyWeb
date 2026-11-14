# Stage 27 — People and admin: a name you can get back, and an Admin page

**Goal:** fix "my name is taken, but it's mine" and "someone else can use my name", and give the admin real tools,
without adding emails or passwords. Plan: "Nook improvement plan: people, admin, chat, languages" (Claude Docs).

## 1. Names with a PIN

- **New people** pick a name **and a PIN** (4 to 6 digits). The PIN is stored only as a slow, salted hash (scrypt),
  never as typed, and never sent back or cached.
- **People from before Stage 27** see "Protect your name" once and choose a PIN. It can't be skipped.
- **Another phone or computer**, three ways (the welcome box, or the You page):
  1. **I have a name:** your name and PIN.
  2. **I have a code:** on a device that's already you, **Settings → Your devices → Sign in another device** shows a
     6-letter code for 5 minutes; type it on the new device. It works once.
  3. **Locked out:** the admin makes an 8-letter **claim code** (24 hours). It signs you in, your old PIN stops working,
     and you choose a new one.
- **Guessing is stopped:** 10 wrong PINs lock that name for 15 minutes, and one visitor can't try more than 30 times
  in 15 minutes across names.
- **A name without a PIN** can only be used on its own browser (nobody can sign into it elsewhere).
- **Deleted names stay reserved for 30 days** (after "Delete me", the admin deleting someone, or the 90-day cleanup),
  so nobody can take a name and pretend to be that person.
- **Settings → Your devices** lists every browser signed in as you ("Phone · iOS · Safari", last used), with
  "Sign out" for each, "Sign out the others", and "Sign out" for this one. Sessions were already stored in the
  database (a hash of the cookie, Stage 11); this stage shows them.

Still no email and no password: Nook never stores an email. (On the cloud install, Cloudflare Access asks visitors for
their email before Nook loads; Cloudflare keeps that, Nook only checks the pass. See docs/stage-20.md.)

## 2. The admin

**Who is admin:** whoever types the passcode from `.env`, on that browser. It is never given to a name, because a name
is easy to claim. What changed:

| Before | Now |
| --- | --- |
| Any passcode length | **16 characters or more**, or admin is switched off (Settings says so) |
| Could be typed over plain http on the home network | Only over **https** (https://localhost, Tailscale, the tunnel) or on the Nook PC itself, so the passcode never travels unencrypted |
| Lasted as long as the browser session (90 days) | **12 hours**, then type it again |
| Nobody saw tries | Every success and every wrong try is in the **admin log** |

**If your passcode is shorter than 16 characters**, change it in `.env` and restart: `docker compose up -d`.

**The Admin page** (Settings → Admin → Open the Admin page, `/admin`):

| Tab | What you can do |
| --- | --- |
| People | Find anyone; rename; make a sign-in code; sign out everywhere; pause for 1 day, 7 days or until lifted (they can read, not post or chat); delete (type their name to confirm). You can't pause or delete yourself |
| Reports | What people reported, with who wrote it, where, and why: **Delete it** or **Keep it** |
| Content | Lock or unlock Hobby Hub groups (read only); remove leaderboard scores; remove songs (with their files) |
| Nook | The banner (a short message at the top of every page, live); storage used by songs and pictures, free disk; run the cleanup now; the admin log (kept 90 days) |
| Health | Database, Valkey, game server, AI and disk: working or not, with the docs page to read when something isn't |

**In Hobby Hub** the admin sees a delete button on everyone's posts, comments and chat messages, and Lock and delete
on every group. Everyone else gets a **Report** button (a flag) on other people's posts, comments, group messages and
private messages.

**Private chats stay private.** The admin can't open anyone's private chat. A private message reaches the admin only
if one of the two people in that chat reports it, and then only that one message.

## 3. No commands on screen

Pages no longer show server commands. The Arena hub says "Try again in a little while. If it keeps happening, tell
the person who runs Nook" (the admin gets a link to Admin → Health); the Companion says the AI is off, resting or
downloading. The commands live only in `docs/`.

## 4. Updating your Nook

```bash
git pull
docker compose up -d --build     # the start scripts also refresh Caddy (Stage 26 fix)
```

The database update runs by itself (new tables `sign_in_codes`, `reserved_names`, `admin_log`, `reports`,
`site_settings`; PIN and pause columns on `users`). Everyone keeps their name; the first time they open Nook they
choose a PIN.

**A fresh start (optional):** to make everyone pick a name and PIN again, back up, then delete all people (songs and
Hobby Hub groups stay; everything else people made goes):

```bash
docker compose exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > nook-backup.sql
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DELETE FROM users; DELETE FROM reserved_names;"'
docker compose restart api arena
```

## 5. For developers

- `api/src/auth/sessions.ts`: `hashPin`/`checkPin` (scrypt, timing-safe), devices, one-time codes (only their hash is
  stored), admin for 12 hours (`admin_until`). The Valkey session cache never holds the PIN hash.
- `api/src/admin.ts`: `adminProblem()` (off / short / https), `isAdmin()`, `logAdmin()`.
- `api/src/routes/me.ts`: `/api/me/pin`, `/sign-in`, `/codes`, `/sign-in/code`, `/sign-out`, `/devices`.
- `api/src/routes/admin.ts`: the Admin page's API, `/api/reports`, `/api/banner`. All in `/developers` (OpenAPI).
- Paused people: `blockPaused` in `middleware/auth.ts` refuses every change except to their own account.
- New settings: `ADMIN_REQUIRE_HTTPS` (default `true`; tests use `false`), `ARENA_URL` (for Health).
- Web: `features/me/NamePrompt.tsx` (`SignInForms`), `PinRequired.tsx`, `DevicesCard.tsx`, `features/admin/*`,
  `components/shell/Banner.tsx` (the banner is in the first HTML, so the page doesn't jump).

## 6. Tests

- `api/tests/signin.test.ts`: PIN never stored as typed; sign in on a new browser; devices and signing out; 10 wrong
  PINs lock the name; a name without a PIN only works on its own device; device codes work once and expire;
  deleted names are reserved; the PIN hash never leaves the API.
- `api/tests/admin.test.ts`: becoming admin is logged and ends after 12 hours; short passcodes and plain http are
  refused; people tools (rename, claim code, pause, sign out, delete with the name typed); Hobby Hub moderation and
  locked groups; reports (only the people in a private chat can report it, the admin sees only that message); banner,
  storage, scores, health, cleanup.
- `web/e2e/stage27.spec.ts`: a name with a PIN, then a second browser by PIN and a third by code.
- Updated: the people and cleanup tests (names are reserved for 30 days); every end-to-end test person has a PIN.

## What wasn't tested

- **Becoming admin over real https** through Caddy, Tailscale or the tunnel: tested with "localhost" and with plain
  http being refused; the https check uses the same `req.secure` that Caddy's headers already drive (Stage 7).
- **A real phone** typing a PIN and a code (tested in an iPhone-sized browser).
- **Health → AI "working"**: the sandbox has no real Ollama, so it showed "Switched off".
- The Vietnamese for the new texts was written by Claude.
