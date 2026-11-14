// Deleting a person (Stage 11): when they ask ("Delete me"), or when cleanup finds them inactive.

import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { reservedNames, songLikes, songPlays, users } from "./db/schema.js";

// Stage 27: a deleted person's name can't be taken by someone else for this long
export const NAME_RESERVED_DAYS = 30;

// Most rows go by themselves ("on delete cascade" in db/schema.ts): sessions, focus history, badges,
// arcade scores, Hobby Hub posts, comments, likes, chat messages and memberships.
// Song plays and likes are stored as "user:<id>", so they're deleted here.
// Songs they added stay for everyone (they're shared), just without "added by".
export async function deletePerson(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [who] = await tx.select({ name: users.name }).from(users).where(eq(users.id, userId));
    if (who) {
      const until = new Date(Date.now() + NAME_RESERVED_DAYS * 86_400_000);
      await tx.insert(reservedNames).values({ name: who.name.toLowerCase(), until }).onConflictDoUpdate({ target: reservedNames.name, set: { until } });
    }
    await tx.delete(songLikes).where(eq(songLikes.owner, `user:${userId}`));
    await tx.delete(songPlays).where(eq(songPlays.owner, `user:${userId}`));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
