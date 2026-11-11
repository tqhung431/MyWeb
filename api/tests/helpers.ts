import { pool } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";

let migrated = false;

// Empty every table and put the starting tips back, so each test starts the same.
export async function resetDatabase() {
  if (!migrated) {
    await runMigrations();
    migrated = true;
  }
  await pool.query("truncate tips, focus_sessions, auth_sessions, users restart identity cascade");
  await seed();
}

// What a browser on our site sends: the page's Origin, and (via the Next.js proxy) the site's host.
export const ORIGIN = "http://localhost:3000";
export const SITE_HOST = "localhost:3000";
