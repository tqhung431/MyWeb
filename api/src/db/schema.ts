// The database tables, described in TypeScript.
// drizzle-kit reads this file and writes the SQL migrations in /drizzle.

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
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

export type Tip = typeof tips.$inferSelect;
export type User = typeof users.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;
