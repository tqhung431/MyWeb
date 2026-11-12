# Stage 21 — Hobby Hub gets personal, and Nook speaks Vietnamese

**Goal:** private chats between two people, joining a group that actually means something, pictures in chats,
the whole site in Vietnamese, and a Settings page for language and colours.

## 1. Hobby Hub

| Feature | How it works |
| --- | --- |
| **Private chats** | Hobby Hub → **Messages**. One conversation per pair of people. Start one with **New** (search by name), from a group's member list, or by tapping a name in a group chat. Live, with "typing…", unread counts and **Seen** |
| **Joining matters** | Only members post, comment and chat; others see a **Join** button in place of the box (anyone can still read and like). Your groups come first with "3 new". Leaving asks first, and stops the counts |
| **Unread badge** | A red number on Hobby Hub's icon (tab bar, sidebar, apps grid) and on the Messages tab: unread private messages + new posts/messages in your groups |
| **Pictures** | Paste one into the message box (Ctrl+V, ⌘V, or Paste on a phone), drop one on the chat, or tap the picture button. Works in group and private chats. Tap a picture to see it big |

How the pieces fit:

```
browser: paste → shrinkImage.ts (≤ 1600 px, WebP/JPEG, ~200 KB) → POST /api/hobby/images (checks the bytes) → id
         → POST /api/hobby/dms/<person> { body, imageId } → saved → Socket.IO "dm:message" to both people's rooms
```

- **Rooms per person:** every browser already joins `user:<id>` (Stage 6), so a private message goes to all of
  that person's tabs and devices, and to nobody else.
- **Unread:** each membership has `last_read_at`; posts and messages after it (not your own) are "new". Opening
  the group marks it read. Private messages have `read_at`.
- **Pictures are checked by their first bytes**, not their name: JPEG, PNG, WebP and GIF only (never SVG, which
  can carry scripts), up to 5 MB, read for width and height. They're stored in the media folder (`media/chat/`),
  next to the songs, and served with `Cache-Control: private` and a sandbox policy.
- **Who sees a picture:** group chat pictures, anyone (group chats are open to read); private chat pictures,
  only the two people (`404` for everyone else).
- **Same rules as chat:** pictures go when their message is deleted, and with the 30-day chat clean-up
  (private chats too). The daily clean-up also removes pictures that were uploaded but never sent.
- "Private" means private between people. Whoever runs the Nook PC can still read its database.

New API endpoints (all in `/developers`): `/api/hobby/dms…`, `/api/hobby/people`, `/api/hobby/unread`,
`/api/hobby/images…`, `PUT /api/hobby/groups/:slug/read`. Migration `0016_private_chats`.

## 2. Nook in Vietnamese

**Settings → Language** (the gear in the phone header, or the sidebar). The first visit follows the browser's
language. The choice is a cookie (`nook_lang`), so the server renders every page in your language from the
start: no flash of English.

How it's built (no library, `web/lib/i18n/`):

- **The English text is the key:** `t("Pick a name")`. `vi.json` holds the Vietnamese for all ~870 texts.
  `{name}` fills in values: `t("Message {name}", { name })`. Plurals are written out (`"1 member"`, `"{n} members"`).
- Texts in plain data (app names, game rules) are marked with `tx("…")` and translated where shown.
- **`tests/i18n.test.ts` searches the code for every `t("…")`/`tx("…")` and fails if Vietnamese is missing**,
  or if a translation lost a `{name}`.
- The dictionary only reaches the browser when you use Vietnamese, so English pages don't get bigger.
- Dates and numbers use the language too ("3 phút trước", "12 thg 11").
- **The API's error messages** are translated on the way out (`api/src/i18n.ts`), from the same cookie.
- **The live feed** ("Linh joined Cooking") is sent as a template plus values, so each person reads it in their
  own language.
- **Vân Lộ** was already in both languages (Stage 16); a new game now starts in Nook's language.

Stays as written: what people write (posts, song titles, group names, the starter groups' names), TVmaze/Jikan
show info, focus tips and Quiz Party questions (stored content, English for now).

## 3. Settings

`/settings`: Language, Light / Dark / System, and the six colour themes. The colour buttons left the sidebar
and the phone header, so they no longer take space on every page.

## What wasn't tested

- The Vietnamese was written by Claude: worth a read by a native speaker. Changing a text in `vi.json` is enough.
- Pasting pictures was tested in Chromium (desktop and phone size) with a simulated paste, not on a real iPhone
  or Android keyboard.
- Lighthouse wasn't re-measured for this stage.
