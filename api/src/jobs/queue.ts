// The job queue: the API puts work here and answers the visitor right away.
// A separate process (the worker, src/worker.ts) picks the jobs up and does them.
//
//   POST /api/sessions ──► save row ──► 201 to the browser   (fast)
//                     └──► queue.add("achievements")          (a few ms)
//                                  ...
//   worker ◄── takes the job ──► checks badges, saves new ones (later)
//
// BullMQ stores the queue in Valkey, so jobs survive an API restart, and failed jobs are retried.

import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config.js";

export type JobData = {
  // Check which achievements this owner has earned (after a focus session or sign-in).
  achievements: { userId: string | null; clientId: string | null; timeZone: string };
  // Stage 11: delete data older than the retention settings (daily).
  cleanup: Record<string, never>;
  // Stage 9: update the Companion's knowledge (embeddings) after songs or tips changed.
  reindex: Record<string, never>;
};
export type JobName = keyof JobData;

let queue: Queue | null = null;

function getQueue(): Queue {
  if (queue) return queue;
  // One connection, made once. Commands wait while it connects, but give up after 1.5 s,
  // so adding a job never hangs a request when Valkey is down.
  const connection = new Redis(config.VALKEY_URL, { maxRetriesPerRequest: 1, commandTimeout: 1500, connectTimeout: 2000 });
  connection.on("error", () => {}); // reported by valkey/client.ts already
  queue = new Queue(config.QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3, // try up to 3 times...
      backoff: { type: "exponential", delay: 2000 }, // ...waiting 2 s, then 4 s
      removeOnComplete: 500, // keep the last 500 finished jobs for looking at, then tidy up
      removeOnFail: 1000,
    },
  });
  queue.on("error", () => {});
  return queue;
}

// Add a job. If Valkey is down, log it and move on: a missing badge or email
// must never make saving a session or signing up fail.
export async function enqueue<N extends JobName>(name: N, data: JobData[N]): Promise<boolean> {
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 2000).unref());
    await Promise.race([getQueue().add(name, data), timeout]);
    return true;
  } catch (error) {
    console.warn(`Could not queue "${name}" job (Valkey down?):`, (error as Error).message);
    return false;
  }
}

// Stage 11: a repeating job. BullMQ keeps the schedule in Valkey, so with several workers it still runs
// once a day in total (not once per worker), and calling this again just updates it.
export async function scheduleCleanup(): Promise<void> {
  try {
    await getQueue().upsertJobScheduler("daily-cleanup", { every: 24 * 60 * 60 * 1000 }, { name: "cleanup", data: {} });
  } catch (error) {
    console.warn("Could not schedule the daily cleanup:", (error as Error).message);
  }
}

export async function closeQueue(): Promise<void> {
  await queue?.close();
  queue = null;
}
