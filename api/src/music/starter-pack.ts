// The starter pack: 12 Creative Commons songs WITH VOCALS from ccMixter, picked by their
// ccMixter ratings (3 per genre). Nook can't download them for you (ccMixter only allows
// downloads from its own pages), so you download them, and Nook recognises them by their
// file name and fills in the credit and licence the licence requires.
// List: seed/starter-pack.json · How to: docs/stage-8.md

import { readFileSync } from "node:fs";
import type { Genre } from "./genre.js";

export type StarterSong = {
  file: string; // the file name ccMixter gives the download
  title: string;
  artist: string;
  credit: string | null;
  genre: Genre;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  durationSec: number;
};

export const STARTER_PACK: StarterSong[] = JSON.parse(
  readFileSync(new URL("../../seed/starter-pack.json", import.meta.url), "utf8"),
);

// Browsers sometimes add " (1)" to repeated downloads; ignore that and letter case.
const norm = (name: string) => name.toLowerCase().replace(/\s*\(\d+\)(?=\.\w+$)/, "");

export function findStarterSong(fileName: string): StarterSong | undefined {
  const n = norm(fileName);
  return STARTER_PACK.find((s) => norm(s.file) === n);
}
