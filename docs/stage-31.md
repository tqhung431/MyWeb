# Stage 31 — The Companion becomes Nook's helper

**Goal:** the owner's remark: "Free-time Companion should be like a chatbot for all about the app, not just music;
don't show songs every chat."

## 1. What changed for people

- **Ask about anything in Nook:** "How do I use my name on another phone?", "What can I play with three friends?",
  "How do I leave a group?", "Where is Listen Together?". The answer says which app to open, and a card under it
  opens that app.
- **Songs only when you ask for music** ("a calm song for studying", "gợi ý nhạc để học"). Then only songs that
  are really on this Nook, and only the ones the answer names get a play card.
- **Cards come after the answer** and show only what it talked about: the app, a focus tip it named, or songs it named.
  No more song cards under every chat.
- New example questions on the empty chat; the box says "Ask about Nook…".
- It never gives setup or server instructions; for problems it suggests asking the person who runs Nook.

## 2. How it works

- `api/src/ai/guide.ts`: a short guide to every app (Focus Room, Music, Games, Messages, Hobby Hub, Habits, WatchList,
  Nook TV, names and PIN, Settings, privacy, the Companion itself), written for people using Nook.
- The guide is indexed like tips and songs (`knowledge.kind = "guide"`, embedded by the worker's `reindex` job; it
  re-embeds only entries whose text changed). When an app changes, update its guide entry.
- `isAboutMusic(question)` (English and Vietnamese words): when it's false, songs are left out of what the model sees.
- The model's instructions now describe Nook's apps and say: use the guide for facts, only suggest songs for music.
- `pickSources(sources, answer)`: after the answer, keep the songs and tips whose titles it mentions, and the guide
  entries it names (or the best match). The `sources` event is now sent after the tokens.

## 3. Updating your Nook

```bash
git pull
docker compose up -d --build
```

The worker indexes the guide by itself the next time the Companion page is opened (or at the daily reindex).
No database changes.

## 4. Tests

- `api/tests/companion.test.ts`: the index includes the guide; a music question streams the answer then the song it
  named; a question about PINs gets the "Your name and PIN" card and no songs; `isAboutMusic` in both languages.
- The fake Ollama (`tests/fake-ollama.ts`) now answers from guide entries too.

## What wasn't tested

- **A real AI model.** The sandbox can't run Ollama; tests and screenshots use the fake, which just repeats the best
  match. How well a small real model (qwen2.5 1.5B) uses the guide needs trying on the Nook PC: ask it a few
  "how do I…" questions after updating.
- The Vietnamese for the new texts was written by Claude.
