import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // Tests use a separate database, so they never touch your real data.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://nook:nook@localhost:5432/nook_test",
      // Valkey database 1 and a separate queue name: tests never touch your dev data (database 0).
      VALKEY_URL: process.env.TEST_VALKEY_URL ?? "redis://127.0.0.1:6379/1",
      QUEUE_NAME: "nook-test",
      MEDIA_DIR: "./tests/.media", // uploaded test songs land here, emptied before each test
      OLLAMA_URL: "http://127.0.0.1:4997", // a fake Ollama (tests/fake-ollama.ts)
    },
    fileParallelism: false, // one shared test database: run files one at a time
  },
});
