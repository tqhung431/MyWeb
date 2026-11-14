# Stage 29 — Privacy and small fixes: members-only groups, a quieter feed, Focus Room

**Goal:** the owner's remarks after Stage 28: leaving a group should hide it, the feed still showed group activity,
Settings explained too much about admin, and Chill Corner gets a clearer name.

## 1. Hobby Hub groups are for their members

- **Anyone can join a group** (the owner's choice: no approval). Before joining you see the group's name, emoji,
  description and how many members it has, and a **Join** button. Not who the members are, and no posts, comments,
  chat or pictures.
- **Leaving hides it all again**, at once: the page goes back to "Posts and chat are for members", and the live
  connection stops sending that group's posts and messages to all your tabs.
- **The admin** can still read every group (to handle reports).
- In the API: posts, comments, likes, chat history and chat pictures answer 403 / 404 to non-members; the live room
  (`group:<slug>`) only lets members in (checked by the cookie's person), and leaving takes every tab of that person
  out of it (`leaveRoom()`).

## 2. The live feed: only Nook-wide things

Live now shows **someone joined Nook, game wins, and new songs**. Nothing about groups any more (started, joined,
posted), and the old lines are hidden too. With "Share my milestones" on (Stage 28), badges, streaks and finished
books show as well.

## 3. Admin: on or off, no hints

- Settings → Admin says only **"Admin isn't enabled on this Nook."** when there's no passcode or it's too short, or
  **"Admin isn't available on this connection."** over plain http on the network. A wrong passcode: **"Wrong passcode"**.
- The page no longer mentions 16 characters, https, Tailscale or docs, and `GET /api/admin` no longer says *why* it's
  off. The person who runs Nook sees the reason in the API's log at start-up
  ("Admin is off: ADMIN_PASSCODE in .env is shorter than 16 characters") and in docs/stage-27.md.
- Music → Add songs: the "add many songs from a folder (docs/stage-8.md)" line shows only to the admin.

## 4. Chill Corner is now Focus Room

The app is **Focus Room** at **`/focus`** (Vietnamese: "Phòng Tập Trung"). `/chill`, `/chill/tips/…` and the older
`/tips` links redirect there. Saves, sounds and timers don't change (the app's id is still `chill` inside the code).

## 5. Updating your Nook

```bash
git pull
docker compose up -d --build
```

No database changes in this stage.

## 6. Tests

- API: `messages.test.ts` (only members read, like, comment and chat; leaving hides it; a non-member sees the
  member count, not the members; chat pictures follow the same rule), `realtime.test.ts` (non-members and guests
  can't listen to a group's room), `hobby.test.ts`, `stage28.test.ts` (the feed has no group lines), `admin.test.ts`
  (visitors only hear "not enabled").
- `web/e2e/stage29.spec.ts`: a visitor sees the locked group, joins and reads, leaves and it's hidden; `/chill/tips`
  opens Focus Room's tips.

## What wasn't tested

- A real phone (tested in an iPhone-sized browser).
- The Vietnamese for the new texts was written by Claude.
