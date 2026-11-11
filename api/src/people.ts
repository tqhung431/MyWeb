// Deleting a person (Stage 11): when they ask ("Delete me"), or when cleanup finds them inactive.

import { eq } from "drizzle-orm";
import { db } from "./db/client.js";
import { songLikes, songPlays, users } from "./db/schema.js";

// Most rows go by themselves ("on delete cascade" in db/schema.ts): sessions, focus history, badges,
// arcade scores, Hobby Hub posts, comments, likes, chat messages and memberships.
// Song plays and likes are stored as "user:<id>", so they're deleted here.
// Songs they added stay for everyone (they're shared), just without "added by".
export async function deletePerson(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(songLikes).where(eq(songLikes.owner, `user:${userId}`));
    await tx.delete(songPlays).where(eq(songPlays.owner, `user:${userId}`));
    await tx.delete(users).where(eq(users.id, userId));
  });
}
