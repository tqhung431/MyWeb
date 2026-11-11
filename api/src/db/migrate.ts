// Applies the SQL files in /drizzle that haven't run yet.
// Drizzle remembers which ones ran in a table called __drizzle_migrations.

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

export async function runMigrations() {
  await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
}

// Run directly: npm run db:migrate
if (import.meta.url === `file://${process.argv[1]}`) {
  await runMigrations();
  console.log("Migrations applied.");
  await pool.end();
}
