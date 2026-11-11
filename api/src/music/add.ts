// Adding one song file, from an upload or from the import command. Shared so both behave the same.

import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { songs, type Song } from "../db/schema.js";
import { HttpError } from "../middleware/errors.js";
import { readSong, removeFiles, store } from "./files.js";
import type { Genre } from "./genre.js";
import { findStarterSong } from "./starter-pack.js";

export type AddSongInput = {
  path: string; // where the file is now
  originalName: string; // its name on the person's computer
  owner: { userId: string | null; clientId: string | null };
  license: string;
  licenseUrl?: string | null;
  credit?: string | null;
  sourceUrl?: string | null;
  genre?: Genre; // only if the person chose one; otherwise detected
  copy?: boolean; // import: copy the file (keep the original); upload: move it
};

export async function addSongFile(input: AddSongInput): Promise<{ song: Song; detected: Genre; starter: boolean }> {
  const read = await readSong(input.path, input.originalName);

  const [existing] = await db.select().from(songs).where(eq(songs.sha256, read.sha256));
  if (existing) throw new HttpError(409, `That song is already in MyWeb: “${existing.title}”`);

  // A starter-pack song: use its known title, artist, credit and licence.
  const starter = findStarterSong(input.originalName);

  const { fileName, artworkFile } = await store(input.path, read, { copy: input.copy });
  try {
    const [song] = await db
      .insert(songs)
      .values({
        fileName,
        artworkFile,
        sha256: read.sha256,
        mimeType: read.mimeType,
        sizeBytes: read.sizeBytes,
        durationSec: read.durationSec,
        title: starter?.title ?? read.title ?? "Untitled",
        artist: starter?.artist ?? read.artist ?? "Unknown artist",
        genre: input.genre ?? starter?.genre ?? read.genre,
        license: starter?.license ?? input.license,
        licenseUrl: starter?.licenseUrl ?? input.licenseUrl ?? null,
        credit: starter?.credit ?? input.credit ?? null,
        sourceUrl: starter?.sourceUrl ?? input.sourceUrl ?? null,
        addedByUserId: input.owner.userId,
        addedByClientId: input.owner.clientId,
      })
      .returning();
    return { song, detected: read.genre, starter: Boolean(starter) };
  } catch (error) {
    await removeFiles(fileName, artworkFile); // don't leave orphan files behind
    throw error;
  }
}
