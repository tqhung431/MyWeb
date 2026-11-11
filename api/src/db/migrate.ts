// Applies the SQL files in /drizzle that haven't run yet.
// Drizzle remembers which ones ran in a table called __drizzle_migrations.

import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

export async function runMigrations() {
  await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
}

// The usual reasons the database can't be reached, in plain words
export function explainDbError(error: unknown): string | null {
  const e = (error as { cause?: { code?: string } }).cause ?? (error as { code?: string });
  switch (e?.code) {
    case "28P01": // wrong password
    case "28000": // no such user
      return [
        "The database refused the password (or the user doesn't exist).",
        "The database keeps the POSTGRES_PASSWORD it was FIRST started with. Either:",
        "  - put that first password back in .env (the old default was \"nook\", or \"myweb\" before the rename), or",
        "  - coming from MyWeb? see \"Coming from MyWeb\" at the end of .env.example, or",
        "  - start over: docker compose down -v   (⚠️ deletes all Nook data), then docker compose up -d",
        "Running with npm run dev? DATABASE_URL in api/.env must use the same user and password.",
      ].join("\n");
    case "3D000":
      return "That database doesn't exist. Check the database name in DATABASE_URL (or POSTGRES_DB in .env).";
    case "ECONNREFUSED":
    case "ENOTFOUND":
      return "Can't reach PostgreSQL. Is it running? (docker compose up -d db)";
    default:
      return null;
  }
}

// Run directly: npm run db:migrate
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await runMigrations();
    console.log("Migrations applied.");
  } catch (error) {
    const help = explainDbError(error);
    console.error(help ? `\n✗ ${help}\n` : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
