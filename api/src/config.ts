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

export const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().startsWith("postgres"),
  PORT: z.coerce.number().int().default(4000),

  // Which network address the API listens on. 127.0.0.1 = only this computer.
  // Other PCs never talk to the API directly: they go through the website, which forwards /api/*.
  // (Stage 7 sets 0.0.0.0 inside Docker, where the website runs in another container.)
  HOST: z.string().default("127.0.0.1"),

  // Extra sites allowed to send POST/PUT/DELETE, comma-separated, e.g. "http://nook.lan:3000".
  // Normally empty: the website you opened is always allowed (see middleware/security.ts).
  ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((o) => o.trim()).filter(Boolean)),

  // --- Stage 5 ---
  // Valkey (a fast in-memory store, compatible with Redis). Used for the cache,
  // shared rate-limit counters and the job queue. Nook still works if it's down.
  VALKEY_URL: z.string().default("redis://127.0.0.1:6379"),
  QUEUE_NAME: z.string().default("nook"),

  // --- Stage 11: how long Nook keeps data, in days ---
  // People not seen for this long are deleted with everything they made (jobs/cleanup.ts).
  // It's also how long "who you are" lasts on a browser you stopped using.
  DATA_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  // Hobby Hub chat messages are deleted after this many days.
  CHAT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30),

  // --- Stage 7 ---
  // Is there a trusted proxy (Caddy) in front that sets X-Forwarded-For / -Proto?
  //   false (default): no, ignore those headers (a browser could fake them)
  //   1: yes, exactly one proxy hop (docker-compose sets this). Then req.ip is the visitor's
  //      real IP, so per-IP rate limits work again, and req.secure knows about HTTPS.
  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((v): boolean | number | string => (v === "false" ? false : v === "true" ? true : /^\d+$/.test(v) ? Number(v) : v)),

  // --- Stage 8: Music files ---
  // Where song files and their cover pictures are kept (a Docker volume in docker-compose).
  MEDIA_DIR: z.string().default("./media"),
  // Stage 12: 100 MB (was 30: too small for FLAC or WAV songs), and how many songs a person may add per hour.
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(100),
  SONG_UPLOADS_PER_HOUR: z.coerce.number().int().positive().default(300),

  // --- Stage 9: local AI (Ollama). Not set → the Companion is off; everything else works. ---
  // docker-compose (profile "ai"): http://ollama:11434 · Ollama on your PC: http://127.0.0.1:11434
  // Empty (OLLAMA_URL= in .env) also means off.
  OLLAMA_URL: z.preprocess((v) => (v === "" ? undefined : v), z.url().optional()),
  // Open models: qwen2.5 1.5B (Apache-2.0) chats, incl. Vietnamese; paraphrase-multilingual
  // (Apache-2.0, 50+ languages incl. Vietnamese, 768 numbers per text) makes embeddings.
  AI_CHAT_MODEL: z.string().default("qwen2.5:1.5b"),
  AI_EMBED_MODEL: z.string().default("paraphrase-multilingual"),

  // OpenTelemetry: where traces and metrics go (Grafana's all-in-one "otel-lgtm" in docker-compose).
  // Not set → telemetry off. Read by the OpenTelemetry SDK itself; listed here so it's documented.
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
});

export const config = configSchema.parse(process.env);
