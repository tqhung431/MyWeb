// The worker: a separate process that takes jobs from the Valkey queue and does them.
//   npm run worker      (alongside `npm run dev` for the API)
//
// You can run several workers (even on several computers): each job goes to exactly one.

import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { processJob } from "./jobs/handlers.js";
import { jobDuration, jobsDone } from "./metrics.js";
import { aiEnabled } from "./ai/ollama.js";
import { enqueue, scheduleCleanup } from "./jobs/queue.js";
import type { JobName } from "./jobs/queue.js";

// A worker waits for jobs with a long blocking command, so it must never give up retrying:
// maxRetriesPerRequest: null (BullMQ requires this for workers).
const connection = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: null });
connection.on("error", (err) => console.warn("Worker can't reach Valkey yet:", err.message));

const worker = new Worker(config.QUEUE_NAME, (job) => processJob(job.name as JobName, job.data), {
  connection,
  concurrency: 5, // up to 5 jobs at the same time
});

worker.on("ready", () => {
  console.log(`Worker ready, waiting for jobs on queue "${config.QUEUE_NAME}"`);
  // Stage 9: on start, make sure the Companion knows every tip and song (unchanged ones are skipped)
  if (aiEnabled()) void enqueue("reindex", {});
  // Stage 11: delete old data now, then once a day (the schedule's first run is right away)
  void scheduleCleanup();
});
worker.on("completed", (job, result) => {
  jobsDone.add(1, { job_name: job.name, status: "completed" });
  if (job.processedOn && job.finishedOn) jobDuration.record((job.finishedOn - job.processedOn) / 1000, { job_name: job.name });
  console.log(`✓ ${job.name} #${job.id} in ${Date.now() - job.timestamp} ms`, JSON.stringify(result));
});
worker.on("failed", (job, err) => {
  jobsDone.add(1, { job_name: job?.name ?? "unknown", status: "failed" });
  const attempts = job ? `${job.attemptsMade}/${job.opts.attempts ?? 1}` : "";
  console.warn(`✗ ${job?.name} #${job?.id} failed (attempt ${attempts}): ${err.message}`);
});

// Ctrl+C: finish the jobs in progress, then close connections.
async function shutdown() {
  console.log("Stopping worker…");
  await worker.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
