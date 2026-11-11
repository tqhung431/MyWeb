import { rm } from "node:fs/promises";
import { pool } from "../src/db/client.js";
import { mediaDir } from "../src/music/files.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import { closeQueue } from "../src/jobs/queue.js";
import { closeEmitter } from "../src/realtime/emit.js";
import { valkey, waitForValkey } from "../src/valkey/client.js";

let migrated = false;

// Empty every table and the test Valkey database, then put the starting tips back,
// so each test starts the same.
export async function resetDatabase() {
  if (!migrated) {
    await runMigrations();
    await waitForValkey();
    migrated = true;
  }
  await pool.query("truncate tips, focus_sessions, achievements, auth_sessions, songs, song_plays, song_likes, knowledge, game_scores, chat_messages, post_likes, post_comments, posts, group_members, hobby_groups, users restart identity cascade");
  await valkey.flushdb(); // only database 1 (see vitest.config.ts)
  await rm(mediaDir, { recursive: true, force: true }); // uploaded test songs
  await seed();
}

export async function closeAll() {
  await closeQueue();
  closeEmitter();
  valkey.disconnect();
  await pool.end();
}

// What a browser on our site sends: the page's Origin, and (via the Next.js proxy) the site's host.
export const ORIGIN = "http://localhost:3000";
export const SITE_HOST = "localhost:3000";
