// Stage 21: pictures in Hobby Hub chats (group chat and private chats).
//
// The browser shrinks a picture before sending it (at most 1600 px on the long side), so most are
// 100–400 KB. Here we only check that the file really is a picture, by its first bytes (never trust the
// name or the type the browser claims), and read its width and height for the chat layout.
//
// Files live in MEDIA_DIR/chat/<id>.<ext>, next to the songs, so backups of the media volume include them.

import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, lt, notExists, and, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatImages, chatMessages, directMessages } from "../db/schema.js";
import { mediaDir } from "../music/files.js";

export const MAX_IMAGE_MB = 5;
export const imageDir = path.join(mediaDir, "chat");

export type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const EXT: Record<ImageType, string> = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };

export type ImageInfo = { type: ImageType; width: number; height: number };

// What kind of picture is this, and how big? null = not a picture we accept (SVG is never accepted:
// it can carry scripts).
export function inspectImage(buf: Buffer): ImageInfo | null {
  if (buf.length < 24) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A, then the IHDR chunk with width and height (big-endian)
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return sized("image/png", buf.readUInt32BE(16), buf.readUInt32BE(20));
  }
  // GIF: "GIF87a" or "GIF89a", then width and height (little-endian)
  if (buf.toString("latin1", 0, 3) === "GIF") return sized("image/gif", buf.readUInt16LE(6), buf.readUInt16LE(8));
  // WebP: "RIFF" .... "WEBP", then one of three chunk kinds
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    const chunk = buf.toString("latin1", 12, 16);
    if (chunk === "VP8X" && buf.length >= 30) return sized("image/webp", 1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3));
    if (chunk === "VP8L" && buf.length >= 25) {
      const b = buf.readUInt32LE(21);
      return sized("image/webp", 1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff));
    }
    if (chunk === "VP8 " && buf.length >= 30) return sized("image/webp", buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff);
    return null;
  }
  // JPEG: FF D8 FF, then segments until a "start of frame" (SOF) marker that holds the size
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      if (marker === 0xff) {
        i++; // padding
        continue;
      }
      const length = buf.readUInt16BE(i + 2);
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return sized("image/jpeg", buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5));
      i += 2 + length;
    }
  }
  return null;
}

function sized(type: ImageType, width: number, height: number): ImageInfo | null {
  if (!width || !height || width > 20000 || height > 20000) return null;
  return { type, width, height };
}

export const imagePath = (id: string, type: string) => path.join(imageDir, `${id}.${EXT[type as ImageType] ?? "bin"}`);

export async function saveImage(uploaderId: string, buf: Buffer, info: ImageInfo) {
  await mkdir(imageDir, { recursive: true });
  const [row] = await db.insert(chatImages).values({ uploaderId, type: info.type, width: info.width, height: info.height, bytes: buf.length }).returning();
  await writeFile(imagePath(row.id, row.type), buf);
  return row;
}

// The picture a message shows, as the browser needs it
export const imageJson = (img: { id: string; width: number; height: number } | null) =>
  img ? { id: img.id, url: `/api/hobby/images/${img.id}`, width: img.width, height: img.height } : null;

// After a message is deleted: delete its picture too, unless another message still shows it.
export async function dropImageIfUnused(id: string | null) {
  if (!id) return;
  const [used] = await db
    .execute<{ used: boolean }>(
      sql`
    select exists (select 1 from chat_messages where image_id = ${id})
        or exists (select 1 from direct_messages where image_id = ${id}) as used`,
    )
    .then((r) => r.rows);
  if (used?.used) return;
  const [img] = await db.delete(chatImages).where(eq(chatImages.id, id)).returning();
  if (img) await rm(imagePath(img.id, img.type), { force: true });
}

// Daily cleanup: pictures no message shows (uploaded but never sent, message deleted, chat expired,
// person deleted) and files without a row. `graceMs` leaves just-uploaded pictures alone.
export async function sweepImages(now = new Date(), graceMs = 60 * 60 * 1000) {
  const before = new Date(now.getTime() - graceMs);
  const gone = await db
    .delete(chatImages)
    .where(
      and(
        lt(chatImages.createdAt, before),
        notExists(
          db
            .select({ one: sql`1` })
            .from(chatMessages)
            .where(eq(chatMessages.imageId, chatImages.id)),
        ),
        notExists(
          db
            .select({ one: sql`1` })
            .from(directMessages)
            .where(eq(directMessages.imageId, chatImages.id)),
        ),
      ),
    )
    .returning();
  for (const img of gone) await rm(imagePath(img.id, img.type), { force: true });

  // Files whose row is gone (e.g. the person was deleted: their rows went with them)
  let files: string[] = [];
  try {
    files = await readdir(imageDir);
  } catch {
    return gone.length; // no pictures yet
  }
  const ids = new Set((await db.select({ id: chatImages.id }).from(chatImages)).map((r) => r.id));
  let orphans = 0;
  for (const file of files) {
    const id = file.split(".")[0];
    if (ids.has(id)) continue;
    const full = path.join(imageDir, file);
    const info = await stat(full).catch(() => null);
    if (info && info.mtime < before) {
      await rm(full, { force: true });
      orphans++;
    }
  }
  return gone.length + orphans;
}
