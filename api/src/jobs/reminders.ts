// Stage 13: habit reminders. The worker runs this every minute (a BullMQ job scheduler, like a cron job).
// At a habit's reminder time (in its owner's time zone), if it isn't done yet today, every Nook tab that
// person has open gets a "reminder" event (Socket.IO), and the page shows a notification.
//
// Each habit is reminded at most once a day (last_reminded_on). A minute missed while the worker was
// restarting is caught up, but nothing more than an hour late is sent.

import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { habitDays, habits } from "../db/schema.js";
import { clockIn, todayIn } from "../habits/days.js";
import { notifyOwner } from "../realtime/emit.js";

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export async function sendReminders(now = new Date()) {
  const list = await db.select().from(habits).where(isNotNull(habits.reminderTime));
  let sent = 0;
  for (const h of list) {
    const today = todayIn(h.timeZone, now);
    const late = minutes(clockIn(h.timeZone, now)) - minutes(h.reminderTime!);
    if (late < 0 || h.lastRemindedOn === today) continue; // not yet, or already today
    await db.update(habits).set({ lastRemindedOn: today }).where(eq(habits.id, h.id));
    if (late > 60) continue; // set up after its time today: start tomorrow
    const [done] = await db
      .select()
      .from(habitDays)
      .where(and(eq(habitDays.habitId, h.id), eq(habitDays.day, today)));
    if (done) continue;
    notifyOwner({ userId: h.userId, clientId: null }, "reminder", { habitId: h.id, name: h.name, emoji: h.emoji, day: today });
    sent++;
  }
  return { sent };
}
