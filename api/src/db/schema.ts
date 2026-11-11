// The database tables, described in TypeScript.
// drizzle-kit reads this file and writes the SQL migrations in /drizzle.

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(), // always stored lower-case
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(), // never the password itself: a scrypt hash
  // Stage 7: personal settings that follow you to every device (e.g. timer lengths)
  preferences: jsonb("preferences").$type<Preferences>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

// --- Stage 7: Music (songs embedded from SoundCloud / YouTube) -------------------
// We store a LINK and its details, never the audio: songs stream from the platform's own
// player, so the artist keeps the rights and gets the plays.

export const songs = pgTable(
  "songs",
  {
    id: serial("id").primaryKey(),
    provider: text("provider", { enum: ["soundcloud", "youtube"] }).notNull(),
    url: text("url").notNull().unique(), // the page people shared, cleaned up
    embedUrl: text("embed_url").notNull(), // the official player's address
    title: text("title").notNull(),
    artist: text("artist").notNull(),
    artworkUrl: text("artwork_url"),
    genre: text("genre", { enum: ["drill", "remix", "pop", "lofi"] }).notNull(),
    addedByUserId: uuid("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
    addedByClientId: uuid("added_by_client_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("song_provider_valid", sql`${t.provider} in ('soundcloud', 'youtube')`),
    check("song_genre_valid", sql`${t.genre} in ('drill', 'remix', 'pop', 'lofi')`),
  ],
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

export type Preferences = { timer?: { focus: number; short: number; long: number } };
export type Song = typeof songs.$inferSelect;
export type Tip = typeof tips.$inferSelect;
export type User = typeof users.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;
