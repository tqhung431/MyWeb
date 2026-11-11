import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests use a separate database, so they never touch your real data.
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://myweb:myweb@localhost:5432/myweb_test",
    },
    fileParallelism: false,
  },
});
