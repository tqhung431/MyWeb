import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Tests use a separate database, so they never touch your real data.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://myweb:myweb@localhost:5432/myweb_test",
      AUTH_RATE_LIMIT: "1000", // tests log in many times; tests/security.test.ts checks the limiter itself
    },
    fileParallelism: false, // one shared test database: run files one at a time
  },
});
