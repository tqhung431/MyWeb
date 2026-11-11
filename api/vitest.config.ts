import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Tests use a separate database, so they never touch your real data.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://myweb:myweb@localhost:5432/myweb_test",
      AUTH_RATE_LIMIT: "1000", // tests log in many times; tests/security.test.ts checks the limiter itself
      // Valkey database 1 and a separate queue name: tests never touch your dev data (database 0).
      VALKEY_URL: process.env.TEST_VALKEY_URL ?? "redis://127.0.0.1:6379/1",
      QUEUE_NAME: "myweb-test",
      // A fake SoundCloud / YouTube (started in tests/music.test.ts)
      SOUNDCLOUD_OEMBED_URL: "http://127.0.0.1:4998/soundcloud/oembed",
      YOUTUBE_OEMBED_URL: "http://127.0.0.1:4998/youtube/oembed",
    },
    fileParallelism: false, // one shared test database: run files one at a time
  },
});
