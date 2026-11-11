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
      MEDIA_DIR: "./tests/.media", // uploaded test songs land here, emptied before each test
      OLLAMA_URL: "http://127.0.0.1:4997", // a fake Ollama (tests/fake-ollama.ts)
    },
    fileParallelism: false, // one shared test database: run files one at a time
  },
});
