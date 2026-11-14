# Stage 28 — Chat and privacy: a Messages app, a message menu, and a feed that shows only what people do together

**Goal:** private chats get their own app, people can fix or take back what they wrote, and the live feed stops
telling everyone what each person does on their own. Plan: "Nook improvement plan: people, admin, chat, languages"
(Claude Docs), section 3–5.

## 1. Messages is its own app

- Private chats moved out of Hobby Hub to **Messages** (`/messages`). It has its own unread badge (sidebar, phone tab
  bar, apps grid); Hobby Hub's badge now counts only group posts and group chats.
- **Phone tab bar:** Home · Chill Corner · Messages · Hobbies · Apps. Music moved under "Apps" (Nook keeps 3 pinned apps).
- **Old links keep working:** `/hobby-hub/messages` and `/hobby-hub/messages/<person>` redirect to `/messages…`.
- Tapping a name in a group chat or a group's member list still opens a private chat with that person.
- Nothing moved in the database: the same `direct_messages` table and `dm:*` live events.

## 2. The message menu

Tap a message (phone), right-click it (computer), or use the **⋯** button next to it (keyboard):

| On your message | On someone else's |
| --- | --- |
| Copy · Edit (for 10 minutes) · Delete | Copy · Report |

- **Delete** has no "Are you sure?" any more: the message turns into "Message deleted" with an **Undo** button for
  5 seconds, then it's deleted for real. Leaving the page or closing the tab doesn't cancel it.
- **"Message deleted" stays in its place** for everyone, so the conversation still makes sense. The words and the
  picture are removed for good (the database keeps only an empty row, and the picture file is deleted).
- **The admin's delete** (Hobby Hub, or a reported message in Admin → Reports) shows **"Removed by the admin"**.
- **Edit:** the message goes into the box, "Editing your message" shows above it, Enter saves, Escape cancels.
  Everyone sees the change at once, with **"edited"** next to the time. After 10 minutes it can't be changed.
- Deleted messages don't count as unread, and the chat list says "Message deleted" when it was the last one.

Posts and comments keep their own Delete buttons (and Report), as before.

## 3. The live feed: what people do together

**Home → Live now** shows only what people do together:

| Shown to everyone | Private now |
| --- | --- |
| … joined Nook | … finished a focus session |
| … started / joined a Hobby Hub group, posted in a group | … wants to watch / is watching / finished a show |
| Game wins (chess, Quiz Party, Ngõ Pháo, Night Market), #1 on a leaderboard | … is listening to a song |
| … added a song (it's in everyone's Music) | Badges, habit streaks, finished books (unless shared, below) |

- **Private means private:** those lines aren't created at all any more, and old ones already in the feed are hidden.
- **Settings → Privacy → "Share my milestones"** (off by default): badges, habit streaks of 7/30/100/365 days and
  finished books appear in Live now again, for people who want that. It's saved with your name, so it follows you
  to every device. Guests never share.

## 4. The admin's sign-in log

**Admin → Nook → Sign-in log**: time, name, how they came in (new name, name and PIN, device code, admin's claim
code) and the kind of device ("Phone, iOS · Safari"). No pages visited, no messages, nothing else. Kept 90 days
(the daily cleanup), and removed with the person.

## 5. Two fixes

- **Nook Arena's tabs** (7 of them) were cut off at the edge with no way to scroll on a computer. Apps with more
  than 4 tabs now put them on their own line under the title, and they wrap onto a second line instead of hiding.
- **Settings → Language** showed "GB" and "VN" on Windows: Windows draws flag emoji as letters, and a flag is a
  country, not a language. It now shows the language code: **EN** English, **VI** Tiếng Việt.

## 6. Updating your Nook

```bash
git pull
docker compose up -d --build
```

The database update runs by itself (two columns on each chat table, the `sign_ins` table).

## 7. For developers

- `api/src/hobby/erase.ts`: `eraseChatMessage()` / `eraseDirectMessage()` (soft delete: empty body, no picture,
  `deleted_by` = author or admin, live event with `by`), `EDIT_MINUTES`, `canStillEdit()`.
- New routes: `PATCH /api/hobby/messages/:id`, `PATCH /api/hobby/dms/messages/:id` (events `hobby:message-edited`,
  `dm:edited`), `GET /api/admin/sign-ins`. All in `/developers`.
- `api/src/realtime/emit.ts`: `publishMilestone()` publishes only when `preferences.shareMilestones`;
  `recentActivity()` filters old private lines (`isShareable`).
- Web: `features/hobby/MessageMenu.tsx` (role="menu", arrow keys), `ChatPanel.tsx` (menu, Undo timers, edit mode,
  placeholders), `app/messages/*`, `UnreadProvider` `badge(href)`, `SettingsPage` `PrivacyCard`.

## 8. Tests

- `api/tests/stage28.test.ts`: delete leaves "Message deleted" (and empties the row), only the author edits, not after
  10 minutes; the admin's delete shows as the admin's; private chats the same, and the chat list knows; the feed shows
  joins and groups but not focus sessions; old private lines are hidden; milestones only when shared; the sign-in
  log (who, how, device, admin only, 90 days, goes with the person).
- Updated: `realtime.test.ts` (badges and focus sessions no longer reach the feed), `messages.test.ts`.
- `web/e2e/stage28.spec.ts`: the old address redirects; edit from the menu ("edited" shows live on the other
  person's screen); Delete then Undo; Delete for real after 5 seconds; Settings → Privacy switch.
  `phone.spec.ts`: the tab bar opens Messages.

## What wasn't tested

- **A real phone's long-press:** the menu opens on a tap (tested in an iPhone-sized browser with touch).
- **Closing the tab during the 5-second Undo** sends the delete on `pagehide`; a browser that's killed (battery,
  crash) may not send it, and the message then simply stays.
- The Vietnamese for the new texts was written by Claude.
