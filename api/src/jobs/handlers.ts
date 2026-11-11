// What each background job does. The worker calls these; tests call them directly too.

import { and, eq, isNull } from "drizzle-orm";
import nodemailer from "nodemailer";
import { ACHIEVEMENTS, earnedCodes } from "../achievements.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { achievements, focusSessions, users } from "../db/schema.js";
import { displayName, notifyOwner, publishActivity } from "../realtime/emit.js";
import { reindex } from "../ai/knowledge.js";
import { AiUnavailable, aiEnabled } from "../ai/ollama.js";
import type { JobData, JobName } from "./queue.js";

// --- achievements ---------------------------------------------------------------
// Read the owner's whole focus history, check every rule, save badges not earned before.
// Safe to run twice: the unique index + "on conflict do nothing" skip existing badges.

export async function checkAchievements({ userId, clientId, timeZone }: JobData["achievements"]) {
  const owner = userId
    ? eq(focusSessions.userId, userId)
    : and(eq(focusSessions.clientId, clientId!), isNull(focusSessions.userId));

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
    const [user] = userId ? await db.select({ name: users.name }).from(users).where(eq(users.id, userId)) : [];
    for (const a of added) {
      const rule = ACHIEVEMENTS.find((r) => r.code === a.code)!;
      notifyOwner({ userId, clientId }, "achievement", {
        code: rule.code,
        title: rule.title,
        description: rule.description,
        icon: rule.icon,
        earnedAt: a.earnedAt,
      });
      await publishActivity(rule.icon, `${displayName(user?.name)} unlocked “${rule.title}”`);
    }
  }
  return { added: added.map((a) => a.code) };
}

// --- welcome email ----------------------------------------------------------------
// Sending email is slow (a second or more) and can fail, which is exactly why it's a job:
// sign-up answers at once, and the worker retries if the mail server hiccups.

const transport = config.SMTP_URL
  ? nodemailer.createTransport(config.SMTP_URL)
  : nodemailer.createTransport({ jsonTransport: true }); // no mail server: build the email, don't send it

export async function sendWelcomeEmail({ userId }: JobData["welcome-email"]) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { skipped: "user deleted" };

  const info = await transport.sendMail({
    from: config.MAIL_FROM,
    to: `${user.name} <${user.email}>`,
    subject: "Welcome to Nook",
    text: [
      `Hi ${user.name},`,
      "",
      "Your Nook account is ready. Your focus history now follows you to any PC or phone.",
      "Start a session whenever you like. Your first badge is one focus session away.",
      "",
      "Take care,",
      "Nook",
    ].join("\n"),
  });

  if (!config.SMTP_URL) {
    console.log(`[email not sent: no SMTP_URL] To: ${user.email} · Subject: Welcome to Nook`);
  }
  return { messageId: info.messageId };
}

// --- dispatcher -------------------------------------------------------------------

export async function processJob(name: JobName, data: unknown) {
  switch (name) {
    case "achievements":
      return checkAchievements(data as JobData["achievements"]);
    case "welcome-email":
      return sendWelcomeEmail(data as JobData["welcome-email"]);
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
