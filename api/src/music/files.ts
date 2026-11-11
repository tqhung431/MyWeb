// Song files: check that an upload really is audio, read what's written inside it
// (title, artist, genre, length, cover picture), and keep it in MEDIA_DIR under a random name.

import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { parseFile } from "music-metadata";
import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { detectGenre, type Genre } from "./genre.js";

export const mediaDir = path.resolve(config.MEDIA_DIR);
export const mediaPath = (name: string) => path.join(mediaDir, path.basename(name)); // basename: no "../" tricks

// What browsers can play everywhere
const AUDIO_TYPES: Record<string, { ext: string; mime: string }> = {
  mpeg: { ext: "mp3", mime: "audio/mpeg" },
  mp3: { ext: "mp3", mime: "audio/mpeg" },
  "mpeg 1 layer 3": { ext: "mp3", mime: "audio/mpeg" },
  aac: { ext: "m4a", mime: "audio/mp4" },
  "mpeg-4/aac": { ext: "m4a", mime: "audio/mp4" },
  mp4: { ext: "m4a", mime: "audio/mp4" },
  "ogg/vorbis": { ext: "ogg", mime: "audio/ogg" },
  vorbis: { ext: "ogg", mime: "audio/ogg" },
  opus: { ext: "opus", mime: "audio/ogg" },
  "ogg/opus": { ext: "opus", mime: "audio/ogg" },
  flac: { ext: "flac", mime: "audio/flac" },
  wave: { ext: "wav", mime: "audio/wav" },
  "wave/pcm": { ext: "wav", mime: "audio/wav" },
};

export type ReadSong = {
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  ext: string;
  durationSec: number | null;
  title: string | null;
  artist: string | null;
  genre: Genre;
  picture: { data: Uint8Array; format: string } | null;
};

export async function readSong(filePath: string, originalName = ""): Promise<ReadSong> {
  let meta;
  try {
    meta = await parseFile(filePath, { duration: true, skipCovers: false });
  } catch {
    throw new HttpError(415, "That file isn't a song MyWeb can read (try MP3, M4A, OGG, FLAC or WAV)");
  }
  const container = (meta.format.container ?? "").toLowerCase();
  const codec = (meta.format.codec ?? "").toLowerCase();
  const type = AUDIO_TYPES[codec] ?? AUDIO_TYPES[container];
  if (!type || !meta.format.duration) {
    throw new HttpError(415, "That file isn't a song MyWeb can read (try MP3, M4A, OGG, FLAC or WAV)");
  }

  const clean = (v: string | undefined) => v?.trim().slice(0, 200) || null;
  const title = clean(meta.common.title) ?? clean(path.parse(originalName).name.replace(/[_]+/g, " "));
  const pic = meta.common.picture?.[0];

  return {
    sha256: await hashFile(filePath),
    sizeBytes: (await stat(filePath)).size,
    mimeType: type.mime,
    ext: type.ext,
    durationSec: Math.round(meta.format.duration),
    title,
    artist: clean(meta.common.artist) ?? clean(meta.common.albumartist),
    genre: detectGenre({ tags: meta.common.genre ?? [], title: title ?? "" }),
    picture: pic && /^image\/(jpeg|png|webp)$/.test(pic.format) ? { data: pic.data, format: pic.format } : null,
  };
}

function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => h.update(chunk))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });
}

// Move (upload) or copy (import) the checked file into MEDIA_DIR; save its cover picture too.
export async function store(
  from: string,
  song: ReadSong,
  { copy = false } = {},
): Promise<{ fileName: string; artworkFile: string | null }> {
  await mkdir(mediaDir, { recursive: true });
  const id = randomUUID();
  const fileName = `${id}.${song.ext}`;
  if (copy) await copyFile(from, mediaPath(fileName));
  else await rename(from, mediaPath(fileName)).catch(async () => {
    await copyFile(from, mediaPath(fileName)); // across disks rename fails: copy, then remove
    await rm(from, { force: true });
  });

  let artworkFile: string | null = null;
  if (song.picture) {
    artworkFile = `${id}.${song.picture.format === "image/png" ? "png" : song.picture.format === "image/webp" ? "webp" : "jpg"}`;
    await writeFile(mediaPath(artworkFile), song.picture.data);
  }
  return { fileName, artworkFile };
}

export async function removeFiles(...names: (string | null | undefined)[]) {
  await Promise.all(names.filter(Boolean).map((n) => rm(mediaPath(n!), { force: true })));
}
