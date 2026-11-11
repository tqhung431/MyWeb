// Settings come from environment variables (or the .env file in development).
// Zod checks them at startup, so a typo fails loudly instead of later at random.

import { z } from "zod";

if (process.env.NODE_ENV !== "test") {
  try {
    process.loadEnvFile(); // reads .env (built into Node.js 21.7+); real env vars win
  } catch {
    // no .env file: fine, use the real environment
  }
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().startsWith("postgres"),
  PORT: z.coerce.number().int().default(4000),

  // Which network address the API listens on. 127.0.0.1 = only this computer.
  // Other PCs never talk to the API directly: they go through the website, which forwards /api/*.
  // (Stage 7 sets 0.0.0.0 inside Docker, where the website runs in another container.)
  HOST: z.string().default("127.0.0.1"),

  // Extra sites allowed to send POST/PUT/DELETE, comma-separated, e.g. "http://myweb.lan:3000".
  // Normally empty: the website you opened is always allowed (see middleware/security.ts).
  ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),

  // Sign-in attempts allowed per email address per 15 minutes.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),
});

export const config = schema.parse(process.env);
