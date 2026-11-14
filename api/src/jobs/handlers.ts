// What each background job does. The worker calls these; tests call them directly too.

import { and, eq, isNull } from "drizzle-orm";
import { ACHIEVEMENTS, earnedCodes } from "../achievements.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { achievements, focusSessions, users } from "../db/schema.js";
import { displayName, notifyOwner, publishMilestone } from "../realtime/emit.js";
import { reindex } from "../ai/knowledge.js";
import { AiUnavailable, aiEnabled } from "../ai/ollama.js";
import { cleanup } from "./cleanup.js";
import { sendReminders } from "./reminders.js";
import type { JobData, JobName } from "./queue.js";

// --- achievements ---------------------------------------------------------------
// Read the owner's whole focus history, check every rule, save badges not earned before.
// Safe to run twice: the unique index + "on conflict do nothing" skip existing badges.

export async function checkAchievements({ userId, clientId, timeZone }: JobData["achievements"]) {
  const owner = userId ? eq(focusSessions.userId, userId) : and(eq(focusSessions.clientId, clientId!), isNull(focusSessions.userId));

  const sessions = await db
    .select({ minutes: focusSessions.minutes, completedAt: focusSessions.completedAt })
    .from(focusSessions)
    .where(and(owner, eq(focusSessions.mode, "focus")));

  const codes = earnedCodes(sessions, timeZone);
  if (codes.length === 0) return { added: [] as string[] };

  const added = await db
    .insert(achievements)
    .values(codes.map((code) => ({ userId, clientId: userId ? null : clientId, code })))
    .onConflictDoNothing()
    .returning({ code: achievements.code, earnedAt: achievements.earnedAt });

  // Stage 6: tell the person right away (all their open tabs and PCs), and tell everyone in the feed.
  if (added.length) {
    const [user] = userId ? await db.select({ name: users.name, preferences: users.preferences }).from(users).where(eq(users.id, userId)) : [];
    for (const a of added) {
      const rule = ACHIEVEMENTS.find((r) => r.code === a.code)!;
      notifyOwner({ userId, clientId }, "achievement", {
        code: rule.code,
        title: rule.title,
        description: rule.description,
        icon: rule.icon,
        earnedAt: a.earnedAt,
      });
      await publishMilestone(user, rule.icon, "{name} unlocked “{_badge}”", { name: displayName(user?.name), _badge: rule.title }); // Stage 28: only if shared
    }
  }
  return { added: added.map((a) => a.code) };
}

// --- dispatcher -------------------------------------------------------------------

export async function processJob(name: JobName, data: unknown) {
  switch (name) {
    case "achievements":
      return checkAchievements(data as JobData["achievements"]);
    case "cleanup":
      return cleanup();
    case "reminders":
      return sendReminders();
    case "reindex":
      // Embedding needs Ollama. Off, not running or models not downloaded yet: skip, it isn't an error.
      // (GET /api/companion/status starts another reindex once the models are ready.)
      if (!aiEnabled()) return { skipped: "AI is off" };
      return reindex().catch((error: unknown) => {
        if (error instanceof AiUnavailable) return { skipped: error.message };
        throw error;
      });
    default:
      throw new Error(`Unknown job: ${name satisfies never}`);
  }
}
