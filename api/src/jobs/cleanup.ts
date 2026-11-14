// Stage 11: Nook keeps data only for a while. The worker runs this once a day (and when it starts).
//
//   people not seen for DATA_RETENTION_DAYS (90)  → deleted, with everything they made
//   guest rows (no name picked) older than that   → deleted
//   Hobby Hub chat older than CHAT_RETENTION_DAYS (30) → deleted, private chats too (Stage 21)
//   chat pictures no message shows any more       → deleted, with their files
//   expired sessions                              → deleted
//   Stage 27: used-up sign-in codes, ended name reservations, admin log and settled reports older than 90 days
//
// Posts and comments stay as long as their author is active.

import { and, isNull, like, lt, ne, notExists, sql } from "drizzle-orm";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { adminLog, reports, reservedNames, signInCodes, achievements, authSessions, chatMessages, directMessages, focusSessions, gameScores, songLikes, songPlays, users, watchEntries, watchTitles, onlineGames, onlineGamePlayers } from "../db/schema.js";
import { sweepImages } from "../hobby/images.js";
import { deletePerson } from "../people.js";
import { broadcast } from "../realtime/emit.js";

const DAY = 24 * 60 * 60 * 1000;

export async function cleanup(now = new Date()) {
  const cutoff = new Date(now.getTime() - config.DATA_RETENTION_DAYS * DAY);
  const chatCutoff = new Date(now.getTime() - config.CHAT_RETENTION_DAYS * DAY);

  const inactive = await db.select({ id: users.id }).from(users).where(lt(users.lastSeenAt, cutoff));
  for (const { id } of inactive) await deletePerson(id);

  const guest = {
    focusSessions: await db
      .delete(focusSessions)
      .where(and(isNull(focusSessions.userId), lt(focusSessions.completedAt, cutoff)))
      .returning({ id: focusSessions.id }),
    badges: await db
      .delete(achievements)
      .where(and(isNull(achievements.userId), lt(achievements.earnedAt, cutoff)))
      .returning({ id: achievements.id }),
    scores: await db
      .delete(gameScores)
      .where(and(isNull(gameScores.userId), lt(gameScores.createdAt, cutoff)))
      .returning({ id: gameScores.id }),
    plays: await db
      .delete(songPlays)
      .where(and(like(songPlays.owner, "client:%"), lt(songPlays.playedAt, cutoff)))
      .returning({ id: songPlays.id }),
    likes: await db
      .delete(songLikes)
      .where(and(like(songLikes.owner, "client:%"), lt(songLikes.likedAt, cutoff)))
      .returning({ songId: songLikes.songId }),
  };
  const chat = await db.delete(chatMessages).where(lt(chatMessages.createdAt, chatCutoff)).returning({ id: chatMessages.id });
  const dms = await db.delete(directMessages).where(lt(directMessages.createdAt, chatCutoff)).returning({ id: directMessages.id });
  const sessions = await db.delete(authSessions).where(lt(authSessions.expiresAt, now)).returning({ id: authSessions.id });
  // Stage 12: WatchList titles nobody has on their list any more
  const titles = await db
    .delete(watchTitles)
    .where(notExists(db.select({ one: sql`1` }).from(watchEntries).where(sql`watch_entries.title_id = watch_titles.id`)))
    .returning({ id: watchTitles.id });
  // Stage 14: Quiz Party games whose players have all been deleted
  await db
    .delete(onlineGames)
    .where(notExists(db.select({ one: sql`1` }).from(onlineGamePlayers).where(sql`online_game_players.game_id = online_games.id`)));

  const images = await sweepImages(now); // after the messages above, so their pictures go too

  // Stage 27
  await db.delete(signInCodes).where(lt(signInCodes.expiresAt, now));
  await db.delete(reservedNames).where(lt(reservedNames.until, now));
  await db.delete(adminLog).where(lt(adminLog.at, cutoff));
  await db.delete(reports).where(and(ne(reports.status, "open"), lt(reports.createdAt, cutoff)));

  if (inactive.length) broadcast("people:changed");
  return {
    people: inactive.length,
    guestRows: Object.values(guest).reduce((n, rows) => n + rows.length, 0),
    chatMessages: chat.length + dms.length,
    chatImages: images,
    sessions: sessions.length,
    watchTitles: titles.length,
  };
}
