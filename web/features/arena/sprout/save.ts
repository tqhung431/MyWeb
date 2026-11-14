// Stage 26 · Mầm Thú: your game, saved in this browser and (with a name) in Nook, so it follows you to another device.
import { SPECIES_NAMES } from "./names";
import { getSave, putSave } from "@/lib/api/games";
import { AREAS } from "./island";
import { makeCreature, SPECIES, type Creature, type SpeciesId } from "./sprout";

export type SproutSave = {
  v: 1;
  name: string; // the gardener (you)
  area: number;
  x: number;
  y: number;
  /** your friends: the first 3 fight; up to 6 travel with you, the rest wait at home */
  team: Creature[];
  home: Creature[];
  nextUid: number;
  keepers: number[]; // areas whose keeper you've beaten
  seen: SpeciesId[];
  friends: SpeciesId[]; // kinds you've befriended (or grown)
  steps: number;
  battles: number;
  seed: number;
  savedAt: number;
};
export const SAVE_KEY = "nook.sprout.save";
export const TEAM_MAX = 6;

export function newSave(name: string, starter: SpeciesId): SproutSave {
  const a = AREAS[0];
  return {
    v: 1,
    name,
    area: 0,
    x: a.enter[0],
    y: a.enter[1],
    team: [makeCreature(1, starter, 5)],
    home: [],
    nextUid: 2,
    keepers: [],
    seen: [starter],
    friends: [starter],
    steps: 0,
    battles: 0,
    seed: Math.floor(Math.random() * 2 ** 31),
    savedAt: Date.now(),
  };
}

/** A save is plain JSON from storage or the network: check its shape before trusting it */
export function validSave(s: unknown): s is SproutSave {
  const x = s as SproutSave;
  return (
    !!x &&
    x.v === 1 &&
    Array.isArray(x.team) &&
    x.team.length > 0 &&
    x.team.every((c) => c && c.species in SPECIES && Number.isFinite(c.level) && Array.isArray(c.moves)) &&
    Array.isArray(x.home) &&
    Number.isInteger(x.area) &&
    x.area >= 0 &&
    x.area < AREAS.length
  );
}

export function readLocal(): SproutSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? JSON.parse(raw) : null;
    return validSave(s) ? s : null;
  } catch {
    return null;
  }
}
export function writeLocal(s: SproutSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {}
}
export function clearLocal() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}

/** The newer of this browser's save and Nook's */
export async function loadBest(signedIn: boolean): Promise<SproutSave | null> {
  const local = readLocal();
  if (!signedIn) return local;
  const cloud = await getSave("sprout").then(
    (r) => (validSave(r.data) ? (r.data as SproutSave) : null),
    () => null,
  );
  if (cloud && (!local || cloud.savedAt > local.savedAt)) {
    writeLocal(cloud);
    return cloud;
  }
  return local;
}

let lastCloud = 0;
/** Save now in the browser; in Nook at most every 20 s (or right away with `force`) */
export function saveGame(s: SproutSave, signedIn: boolean, force = false) {
  s.savedAt = Date.now();
  writeLocal(s);
  if (!signedIn || (!force && Date.now() - lastCloud < 20_000)) return;
  lastCloud = Date.now();
  const lead = s.team[0];
  void putSave("sprout", {
    version: 1,
    summary: `${AREAS[s.area].en} · ${s.keepers.length}/6 · ${s.friends.length}`,
    data: s,
    // the shared games leaderboard: shrines awakened first, then friends made
    board: { path: SPECIES_NAMES[lead.species].slice(0, 20), // Stage 30: the English name (shown with t())
      level: s.keepers.length, kills: s.friends.length },
  }).catch(() => {});
}
