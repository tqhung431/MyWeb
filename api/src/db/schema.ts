// The database tables, described in TypeScript.
// drizzle-kit reads this file and writes the SQL migration in /drizzle.

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tips = pgTable("tips", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(), // used in the URL: /tips/real-breaks
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  body: text("body").array().notNull(), // one string per paragraph
  minutes: integer("minutes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: serial("id").primaryKey(),
    // Anonymous id stored in the browser. Stage 4 (login) links sessions to a real user.
    clientId: uuid("client_id").notNull(),
    mode: text("mode", { enum: ["focus", "short", "long"] }).notNull(),
    minutes: integer("minutes").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // The database itself refuses bad data, even if the API had a bug.
    check("mode_valid", sql`${t.mode} in ('focus', 'short', 'long')`),
    check("minutes_valid", sql`${t.minutes} between 1 and 120`),
    // Makes "this client's sessions, newest first" fast.
    index("focus_sessions_client_time_idx").on(t.clientId, t.completedAt),
  ],
);

export type Tip = typeof tips.$inferSelect;
export type FocusSession = typeof focusSessions.$inferSelect;
