// Settings checks.
import { describe, expect, it } from "vitest";
import { configSchema } from "../src/config.js";

describe("config", () => {
  const base = { DATABASE_URL: "postgres://nook:nook@localhost:5432/nook" };

  it("treats an empty OLLAMA_URL as 'AI off' instead of refusing to start", () => {
    expect(configSchema.parse({ ...base, OLLAMA_URL: "" }).OLLAMA_URL).toBeUndefined();
    expect(configSchema.parse(base).OLLAMA_URL).toBeUndefined();
    expect(configSchema.parse({ ...base, OLLAMA_URL: "http://ollama:11434" }).OLLAMA_URL).toBe("http://ollama:11434");
  });

  it("still refuses a broken OLLAMA_URL", () => {
    expect(() => configSchema.parse({ ...base, OLLAMA_URL: "not a url" })).toThrow();
  });
});
