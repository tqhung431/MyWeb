// Stage 28: deleting and editing chat messages (group chats and private chats).
//
// A deleted message keeps its place, so the conversation still makes sense: its words and picture are
// removed for good (the picture file too) and every screen shows "Message deleted" (or "Removed by the
// admin") instead. A message can be edited by the person who wrote it for EDIT_MINUTES; it then shows "edited".

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatMessages, directMessages, hobbyGroups } from "../db/schema.js";
import { groupRoom, notifyOwner, toRoom } from "../realtime/emit.js";
import { dropImageIfUnused } from "./images.js";

export const EDIT_MINUTES = 10;
export type DeletedBy = "author" | "admin";

export const canStillEdit = (createdAt: Date) => Date.now() - createdAt.getTime() <= EDIT_MINUTES * 60_000;

/** Group chat message → "Message deleted" for everyone with the group open */
export async function eraseChatMessage(id: number, by: DeletedBy) {
  const [before] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
  if (!before || before.deletedBy) return before ?? null;
  await db.update(chatMessages).set({ body: "", imageId: null, deletedBy: by, editedAt: null }).where(eq(chatMessages.id, id));
  await dropImageIfUnused(before.imageId);
  const [g] = await db.select({ slug: hobbyGroups.slug }).from(hobbyGroups).where(eq(hobbyGroups.id, before.groupId));
  if (g) toRoom(groupRoom(g.slug), "hobby:message-deleted", { slug: g.slug, id, by });
  return before;
}

/** Private message → "Message deleted" on both people's screens */
export async function eraseDirectMessage(id: number, by: DeletedBy) {
  const [before] = await db.select().from(directMessages).where(eq(directMessages.id, id));
  if (!before || before.deletedBy) return before ?? null;
  await db.update(directMessages).set({ body: "", imageId: null, deletedBy: by, editedAt: null }).where(eq(directMessages.id, id));
  await dropImageIfUnused(before.imageId);
  notifyOwner({ userId: before.senderId, clientId: null }, "dm:deleted", { with: before.recipientId, id, by });
  notifyOwner({ userId: before.recipientId, clientId: null }, "dm:deleted", { with: before.senderId, id, by });
  return before;
}
