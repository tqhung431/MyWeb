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
  DATABASE_URL: z.string().startsWith("postgres"),
  PORT: z.coerce.number().int().default(4000),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
});

export const config = schema.parse(process.env);
