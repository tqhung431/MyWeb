// Add every song in a folder at once:
//
//   npm run music:import -- ../music-import                          (your PC)
//   docker compose exec api node dist/music/import.js /import        (Docker: ./music-import is mounted at /import)
//
// Starter-pack songs (seed/starter-pack.json) are recognised by file name and get their credit
// and licence automatically. For any other song, say what allows you to share it:
//
//   npm run music:import -- ../my-songs --license "Own work"

import { readdir } from "node:fs/promises";
import path from "node:path";
import { pool } from "../db/client.js";
import { HttpError } from "../middleware/errors.js";
import { valkey } from "../valkey/client.js";
import { addSongFile } from "./add.js";
import { findStarterSong } from "./starter-pack.js";

const AUDIO = /\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i;

async function main() {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--"));
  const licenseFlag = args.indexOf("--license");
  const license = licenseFlag >= 0 ? args[licenseFlag + 1] : undefined;
  if (!folder) {
    console.log('Usage: npm run music:import -- <folder> [--license "Own work"]');
    process.exitCode = 1;
    return;
  }

  const files = (await readdir(folder)).filter((f) => AUDIO.test(f)).sort();
  if (files.length === 0) console.log(`No song files in ${path.resolve(folder)}`);
  let added = 0;
  for (const name of files) {
    const starter = findStarterSong(name);
    if (!starter && !license) {
      console.log(`– skipped ${name}: not in the starter pack; add --license "…" if you may share it`);
      continue;
    }
    try {
      const { song } = await addSongFile({
        path: path.join(folder, name),
        originalName: name,
        owner: { userId: null, clientId: null },
        license: license ?? "",
        copy: true, // keep your original file
      });
      added++;
      console.log(`✓ ${song.title} — ${song.artist}  [${song.genre}]  ${song.license}`);
    } catch (error) {
      console.log(`– skipped ${name}: ${error instanceof HttpError ? error.message : (error as Error).message}`);
    }
  }
  console.log(`\nAdded ${added} of ${files.length} song(s).`);
}

await main();
await pool.end();
valkey.disconnect();
