// Stage 21: words the API sends that the website shows (translated with t() where shown).
// They're listed here so the translation test checks that Vietnamese has each of them.
// Keep in step with: api/src/achievements.ts, publishActivity() calls, api/src/arcade-online/questions.ts.
import { tx } from "./core";

export const SERVER_TEXTS = [
  // Live activity (Home → Live now)
  tx("{name} unlocked “{_badge}”"),
  tx("{name} won Quiz Party against {a} ({score} pts)"),
  tx("{name} won Quiz Party against {a} and {b} ({score} pts)"),
  tx("{name} won Quiz Party against {n} others ({score} pts)"),
  tx("{name} won a chess game against {other}"),
  tx("{name} finished a {n}-min focus session"),
  tx("{name} kept “{habit}” going for {n} days in a row"),
  tx("{name} finished reading “{book}”"),
  tx("{name} wants to watch “{title}”"),
  tx("{name} is watching “{title}”"),
  tx("{name} finished “{title}”{stars}"),
  tx("{name} stopped watching “{title}”"),
  tx("{name} started the group {group}"),
  tx("{name} joined {group}"),
  tx("{name} posted in {group}"),
  tx("{name} is now #1 in {_game} ({score} {_unit})"),
  tx("{name} added “{title}” by {artist}"),
  tx("{name} is listening to “{title}”"),
  tx("{name} joined Nook"),
  tx("A guest"),
  // Achievements
  tx("First focus"),
  tx("Finish your first focus session"),
  tx("Getting into it"),
  tx("Finish 5 focus sessions"),
  tx("Deep worker"),
  tx("Finish 20 focus sessions"),
  tx("Full round"),
  tx("4 focus sessions in one day"),
  tx("On a roll"),
  tx("Focus 3 days in a row"),
  tx("Hundred minutes"),
  tx("100 minutes of focus in total"),
  tx("Early bird"),
  tx("Finish a session before 7 am"),
  tx("Night owl"),
  tx("Finish a session after 10 pm"),
];
