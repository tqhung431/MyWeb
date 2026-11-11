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

  // The address people open in their browser (the Next.js site).
  // Used for CSRF checks and for the GitHub callback URL.
  PUBLIC_URL: z.url().default("http://localhost:3000"),

  // How many login/register attempts one IP may make per 15 minutes.
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(10),

  // GitHub login is optional: it switches on when both values are set.
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  // Only changed in tests, to point at a fake GitHub.
  GITHUB_AUTH_URL: z.url().default("https://github.com/login/oauth/authorize"),
  GITHUB_TOKEN_URL: z.url().default("https://github.com/login/oauth/access_token"),
  GITHUB_API_URL: z.url().default("https://api.github.com"),
});

export const config = schema.parse(process.env);

export const githubEnabled = Boolean(config.GITHUB_CLIENT_ID && config.GITHUB_CLIENT_SECRET);
