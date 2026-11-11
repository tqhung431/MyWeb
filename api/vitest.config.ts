import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Tests use a separate database, so they never touch your real data.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://myweb:myweb@localhost:5432/myweb_test",
      AUTH_RATE_LIMIT: "1000", // tests log in many times; tests/security.test.ts checks the limiter itself
      // A fake GitHub (started in tests/auth.test.ts) instead of the real one.
      GITHUB_CLIENT_ID: "test-client",
      GITHUB_CLIENT_SECRET: "test-secret",
      GITHUB_AUTH_URL: "http://127.0.0.1:4999/login/oauth/authorize",
      GITHUB_TOKEN_URL: "http://127.0.0.1:4999/login/oauth/access_token",
      GITHUB_API_URL: "http://127.0.0.1:4999",
    },
    fileParallelism: false, // one shared test database: run files one at a time
  },
});
