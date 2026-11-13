// The database tables, described in TypeScript.
// drizzle-kit reads this file and writes the SQL migrations in /drizzle.

import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid, vector } from "drizzle-orm/pg-core";

export const tips = pgTable("tips", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // used in the URL: /tips/real-breaks
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").array().notNull(), // one string per paragraph
  minutes: integer("minutes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- Stage 4: accounts -------------------------------------------------------

// Stage 11: a person is just a NAME (no email, no password), on one browser.
// The browser holds a random session token in a cookie (see auth/sessions.ts).
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(), // unique, ignoring upper/lower case: "Linh" and "linh" can't both exist
    // Stage 7: personal settings (e.g. timer lengths)
    preferences: jsonb("preferences").$type<Preferences>().notNull().default({}),
    // Stage 11: people not seen for DATA_RETENTION_DAYS are deleted with their data (jobs/cleanup.ts)
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_name_lower_idx").on(sql`lower(${t.name})`), index("users_last_seen_idx").on(t.lastSeenAt)],
);

// A logged-in browser. The cookie holds a random token; we store only its SHA-256 hash,
// so someone who reads this table still can't log in as anyone.
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(), // sha256(token)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    // Stage 22: this browser typed the admin passcode (Nook TV: add videos, share a tab)
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

// --- Focus sessions ----------------------------------------------------------

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: serial("id").primaryKey(),
    // Stage 4: belongs to a user when logged in...
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    // ...or to an anonymous browser (Stage 3) when not.
    clientId: uuid("client_id"),
    mode: text("mode", { enum: ["focus", "short", "long"] }).notNull(),
    minutes: integer("minutes").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The database itself refuses bad data, even if the API had a bug.
    check("mode_valid", sql`${t.mode} in ('focus', 'short', 'long')`),
    check("minutes_valid", sql`${t.minutes} between 1 and 120`),
    check("has_owner", sql`${t.userId} is not null or ${t.clientId} is not null`),
    index("focus_sessions_client_time_idx").on(t.clientId, t.completedAt),
    index("focus_sessions_user_time_idx").on(t.userId, t.completedAt),
  ],
);

// --- Stage 5: achievements (written by the background worker) -----------------

export const achievements = pgTable(
  "achievements",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id"),
    code: text("code").notNull(), // e.g. "first-focus" (rules in src/achievements.ts)
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("achievement_has_owner", sql`${t.userId} is not null or ${t.clientId} is not null`),
    // Each badge only once per owner. (NULLs never clash, so guests and users don't collide.)
    uniqueIndex("achievements_user_code_idx").on(t.userId, t.code),
    uniqueIndex("achievements_client_code_idx").on(t.clientId, t.code),
  ],
);

// --- Music (Stage 7, files since Stage 8) ---------------------------------------
// Nook stores the song FILES itself and plays them in its own player, so they work on any
// network that can open Nook (no SoundCloud / YouTube needed, nothing for a firewall to block).
// Only songs the uploader may share: their own, or ones with a licence that allows it.

export const songs = pgTable(
  "songs",
  {
    id: serial("id").primaryKey(),
    fileName: text("file_name").notNull().unique(), // random name inside MEDIA_DIR
    sha256: text("sha256").notNull().unique(), // fingerprint: the same file can't be added twice
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    durationSec: integer("duration_sec"),
    artworkFile: text("artwork_file"), // cover picture taken from the file, if it has one
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    genre: text("genre", { enum: ["drill", "remix", "pop", "lofi"] }).notNull(),
    license: text("license").notNull(), // e.g. "CC BY-NC 3.0" or "Own work"
    licenseUrl: text("license_url"),
    credit: text("credit"), // featuring / original artists, as the licence asks
    sourceUrl: text("source_url"), // where it came from (e.g. its ccMixter page)
    addedByUserId: uuid("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
    addedByClientId: uuid("added_by_client_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("song_genre_valid", sql`${t.genre} in ('drill', 'remix', 'pop', 'lofi')`)],
);

export const songPlays = pgTable(
  "song_plays",
  {
    id: serial("id").primaryKey(),
    songId: integer("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(), // "user:<id>" or "client:<id>"
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("song_plays_time_idx").on(t.playedAt, t.songId), index("song_plays_owner_idx").on(t.owner, t.songId, t.playedAt)],
);

export const songLikes = pgTable(
  "song_likes",
  {
    songId: integer("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    owner: text("owner").notNull(),
    likedAt: timestamp("liked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.songId, t.owner] }), index("song_likes_time_idx").on(t.likedAt)],
);

// --- Stage 9: the Companion's knowledge (embeddings) --------------------------------
// One row per tip and per song: its text, and an EMBEDDING, a list of 768 numbers that captures
// its meaning. Texts with similar meanings get nearby numbers, so "something calm for studying"
// finds a lofi song even if no word matches. pgvector stores and searches them.

export const EMBEDDING_DIMENSIONS = 768; // paraphrase-multilingual (change with the model, plus a migration)

export const knowledge = pgTable(
  "knowledge",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["tip", "song"] }).notNull(),
    refId: text("ref_id").notNull(), // tip slug or song id
    content: text("content").notNull(), // the text that was embedded
    contentHash: text("content_hash").notNull(), // unchanged text → no need to embed again
    model: text("model").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("knowledge_kind_ref_idx").on(t.kind, t.refId),
    // HNSW: a graph index that finds the nearest meanings fast, even with many rows
    index("knowledge_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

// --- Stage 10: Mini Arcade high scores ---------------------------------------------
// One row per finished game. The leaderboards take each person's best row.

export const gameScores = pgTable(
  "game_scores",
  {
    id: serial("id").primaryKey(),
    game: text("game").notNull(), // "worm", "pairs"… (rules in src/arcade/games.ts)
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    clientId: uuid("client_id"),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("game_score_has_owner", sql`${t.userId} is not null or ${t.clientId} is not null`),
    index("game_scores_game_time_idx").on(t.game, t.createdAt),
    index("game_scores_user_idx").on(t.userId, t.game),
    index("game_scores_client_idx").on(t.clientId, t.game),
  ],
);

// --- Stage 11: Hobby Hub ----------------------------------------------------------------
// Groups (Gaming, Cooking…), each with a board of posts (comments, likes) and a live chat.
// Deleting a person deletes everything they wrote (onDelete: cascade).

export const hobbyGroups = pgTable("hobby_groups", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // in the URL: /hobby-hub/cooking
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  description: text("description").notNull().default(""),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }), // null = a starter group
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => hobbyGroups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    // Stage 21: posts and messages after this count as unread for this member
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.userId] }), index("group_members_user_idx").on(t.userId)],
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => hobbyGroups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("posts_group_time_idx").on(t.groupId, t.createdAt), index("posts_author_idx").on(t.authorId)],
);

export const postComments = pgTable(
  "post_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("post_comments_post_time_idx").on(t.postId, t.createdAt), index("post_comments_author_idx").on(t.authorId)],
);

export const postLikes = pgTable(
  "post_likes",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    likedAt: timestamp("liked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] }), index("post_likes_user_idx").on(t.userId)],
);

// Stage 21: pictures sent in a chat (group or private). The file is MEDIA_DIR/chat/<id>.<ext>.
// A picture is uploaded first, then sent with a message; the daily cleanup deletes pictures
// that no message uses any more (message deleted, chat expired, person deleted).
export const chatImages = pgTable(
  "chat_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // image/jpeg, image/png, image/webp, image/gif
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_images_uploader_idx").on(t.uploaderId)],
);

// Chat messages are short-lived: deleted after CHAT_RETENTION_DAYS.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => hobbyGroups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(), // "" when the message is just a picture
    imageId: uuid("image_id").references(() => chatImages.id, { onDelete: "set null" }), // Stage 21
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chat_messages_group_time_idx").on(t.groupId, t.createdAt), index("chat_messages_time_idx").on(t.createdAt)],
);

// Stage 21: private chats between two people. Same rules as group chat: deleted after
// CHAT_RETENTION_DAYS, and with either person.
export const directMessages = pgTable(
  "direct_messages",
  {
    id: serial("id").primaryKey(),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageId: uuid("image_id").references(() => chatImages.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }), // null = the recipient hasn't seen it yet
  },
  (t) => [
    index("direct_messages_pair_idx").on(t.senderId, t.recipientId, t.id),
    index("direct_messages_unread_idx").on(t.recipientId, t.readAt),
    index("direct_messages_time_idx").on(t.createdAt),
  ],
);

// --- Stage 12: WatchList --------------------------------------------------------------
// A local copy of each show or anime that someone saved (from TVmaze or Jikan), so lists keep working
// even when those websites are slow or down, and one entry per person per title.

export const watchTitles = pgTable(
  "watch_titles",
  {
    id: serial("id").primaryKey(),
    source: text("source", { enum: ["tv", "anime"] }).notNull(), // tv = TVmaze, anime = Jikan (MyAnimeList)
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    originalTitle: text("original_title"),
    year: integer("year"),
    kind: text("kind").notNull(), // "TV show", "Anime series", "Anime movie"…
    imageUrl: text("image_url"),
    summary: text("summary").notNull().default(""),
    genres: text("genres")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    rating: integer("rating"), // the source's score × 10 (8.5 → 85), null if unknown
    episodes: integer("episodes"),
    url: text("url"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("watch_titles_source_ext_idx").on(t.source, t.externalId)],
);

export const WATCH_STATUSES = ["want", "watching", "done", "dropped"] as const;

export const watchEntries = pgTable(
  "watch_entries",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    titleId: integer("title_id")
      .notNull()
      .references(() => watchTitles.id, { onDelete: "cascade" }),
    status: text("status", { enum: WATCH_STATUSES }).notNull(),
    stars: integer("stars"), // your rating, 1–5
    note: text("note").notNull().default(""),
    episodesSeen: integer("episodes_seen"),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.titleId] }),
    index("watch_entries_title_idx").on(t.titleId),
    index("watch_entries_updated_idx").on(t.updatedAt),
    check("watch_status_valid", sql`${t.status} in ('want', 'watching', 'done', 'dropped')`),
    check("watch_stars_valid", sql`${t.stars} is null or ${t.stars} between 1 and 5`),
  ],
);

// --- Stage 13: Habit & Reading Tracker ---------------------------------------------------
// Days are calendar dates in YOUR time zone ("2026-11-11"), not moments: "did I read today?"

export const habits = pgTable(
  "habits",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    color: text("color").notNull().default("violet"),
    perWeek: integer("per_week").notNull().default(7), // goal: days a week (7 = every day)
    reminderTime: text("reminder_time"), // "20:30" in timeZone, or null
    timeZone: text("time_zone").notNull().default("UTC"),
    lastRemindedOn: date("last_reminded_on", { mode: "string" }), // so a reminder fires once a day
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("habits_user_idx").on(t.userId),
    index("habits_reminder_idx").on(t.reminderTime),
    check("habit_per_week_valid", sql`${t.perWeek} between 1 and 7`),
  ],
);

export const habitDays = pgTable(
  "habit_days",
  {
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.habitId, t.day] })],
);

export const BOOK_STATUSES = ["want", "reading", "finished"] as const;

export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author").notNull().default(""),
    totalPages: integer("total_pages"),
    currentPage: integer("current_page").notNull().default(0),
    status: text("status", { enum: BOOK_STATUSES }).notNull().default("reading"),
    startedOn: date("started_on", { mode: "string" }),
    finishedOn: date("finished_on", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("books_user_idx").on(t.userId), check("book_status_valid", sql`${t.status} in ('want', 'reading', 'finished')`)],
);

// Pages read per book per day (adding pages twice on one day adds them up)
export const readingLog = pgTable(
  "reading_log",
  {
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    pages: integer("pages").notNull(),
  },
  (t) => [primaryKey({ columns: [t.bookId, t.day] }), index("reading_log_user_day_idx").on(t.userId, t.day)],
);

// --- Stage 14: Arcade Online (Quiz Party) results -------------------------------------------
// Games are played in the API's memory; when one ends, its result is saved here for the leaderboard.

export const onlineGames = pgTable("online_games", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  category: text("category").notNull(),
  rounds: integer("rounds").notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
});

export const onlineGamePlayers = pgTable(
  "online_game_players",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => onlineGames.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    correct: integer("correct").notNull(),
    place: integer("place").notNull(), // 1 = won
    players: integer("players").notNull(), // how many played (a win against 3 people means more)
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] }), index("online_game_players_user_idx").on(t.userId)],
);

// Stage 16: Nook Games. One save per person per game (the whole game state as JSON).
// The game checks the save's shape when loading it, so the API only limits its size.
export const gameSaves = pgTable(
  "game_saves",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    game: text("game").notNull(), // e.g. "van-lo"
    version: integer("version").notNull(),
    data: jsonb("data").notNull(),
    summary: text("summary").notNull().default(""), // a short line for lists, e.g. "Luyện Khí tầng 5"
    // Stage 18: for the cultivation leaderboard (the game sends them with each save)
    path: text("path").notNull().default(""),
    level: integer("level").notNull().default(0), // Luyện Khí 1 = 1 … Nguyên Anh 9 = 36
    kills: integer("kills").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.game] }), index("game_saves_board_idx").on(t.game, t.level)],
);

export type Preferences = { timer?: { focus: number; short: number; long: number } };
export type Song = typeof songs.$inferSelect;
export type Tip = typeof tips.$inferSelect;
export type User = typeof users.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;

// --- Stage 22: Nook Arena -------------------------------------------------------------------
// Live games run in the game server's memory (api/src/arena); only results are stored.

// A finished chess game. A side is a person or "Nook" (the computer, with a level 1–4).
export const chessGames = pgTable(
  "chess_games",
  {
    id: serial("id").primaryKey(),
    whiteId: uuid("white_id").references(() => users.id, { onDelete: "cascade" }),
    blackId: uuid("black_id").references(() => users.id, { onDelete: "cascade" }),
    whiteName: text("white_name").notNull(),
    blackName: text("black_name").notNull(),
    mode: text("mode", { enum: ["live", "nook"] }).notNull(),
    nookLevel: integer("nook_level"),
    timeControl: text("time_control").notNull(), // "none", "5+0", "10+0", "15+10"
    pgn: text("pgn").notNull(),
    result: text("result", { enum: ["1-0", "0-1", "1/2-1/2"] }).notNull(),
    reason: text("reason").notNull(), // checkmate, resign, time, stalemate, draw…
    endedAt: timestamp("ended_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chess_games_white_idx").on(t.whiteId), index("chess_games_black_idx").on(t.blackId)],
);

// A person's rating (Elo) in one live game. Starts at 1200.
export const arenaRatings = pgTable(
  "arena_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    game: text("game").notNull(),
    rating: integer("rating").notNull().default(1200),
    games: integer("games").notNull().default(0),
    wins: integer("wins").notNull().default(0),
    draws: integer("draws").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.game] }), index("arena_ratings_game_idx").on(t.game, t.rating)],
);

// Stage 24: Giữ Làng (Keep the Village) results, per map. Solo games are sent by the browser; co-op by the game server.
export const villageScores = pgTable(
  "village_scores",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    map: text("map").notNull(),
    mode: text("mode", { enum: ["solo", "coop"] }).notNull(),
    endless: boolean("endless").notNull().default(false),
    waves: integer("waves").notNull(),
    rice: integer("rice").notNull(),
    won: boolean("won").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("village_scores_map_idx").on(t.map, t.score), index("village_scores_user_idx").on(t.userId)],
);

// Nook TV: YouTube videos and playlists the admin chose, on shelves
export const tvVideos = pgTable(
  "tv_videos",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["video", "playlist"] }).notNull(),
    youtubeId: text("youtube_id").notNull(),
    title: text("title").notNull(),
    shelf: text("shelf").notNull(),
    position: integer("position").notNull().default(0),
    addedBy: uuid("added_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tv_videos_kind_id_idx").on(t.kind, t.youtubeId), index("tv_videos_shelf_idx").on(t.shelf, t.position)],
);
