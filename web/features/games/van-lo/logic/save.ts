// Saves: the whole Game as JSON, on this device (localStorage) and, if you picked a name, in Nook's database.
// A save from somewhere else is never trusted blindly: parseSave() checks its shape first.

import { MAJOR_REALMS, TECHNIQUES } from "./data";
import { SAVE_VERSION, type Game } from "./types";

export const LOCAL_KEY = "nook.vanlo.save";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown) => typeof v === "number" && Number.isFinite(v);

export function parseSave(raw: unknown): Game | null {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isObj(data) || data.v !== SAVE_VERSION) return null;
  const p = data.player;
  if (!isObj(p)) return null;
  const okPlayer =
    typeof p.name === "string" &&
    Array.isArray(p.root) &&
    isNum(p.major) &&
    (p.major as number) >= 0 &&
    (p.major as number) < MAJOR_REALMS.length &&
    isNum(p.layer) &&
    (p.layer as number) >= 1 &&
    (p.layer as number) <= 9 &&
    isNum(p.cultivation) &&
    isNum(p.hp) &&
    isNum(p.qi) &&
    isNum(p.stones) &&
    Array.isArray(p.techniques) &&
    (p.techniques as unknown[]).every((t) => isObj(t) && typeof t.id === "string" && t.id in TECHNIQUES && isNum(t.level)) &&
    typeof p.main === "string" &&
    Array.isArray(p.skills) &&
    Array.isArray(p.treasures) &&
    Array.isArray(p.bound) &&
    Array.isArray(p.gear) &&
    isObj(p.equipped) &&
    isObj(p.bag) &&
    isObj(p.record);
  if (!okPlayer) return null;
  if (!isNum(data.seed) || !isNum(data.rng) || !isNum(data.uid) || !isNum(data.updatedAt)) return null;
  if (data.run !== null) {
    const r = data.run;
    if (!isObj(r) || !isObj(r.floor) || !isObj(r.pos) || typeof (r.floor as Record<string, unknown>).tiles !== "string") return null;
  }
  return data as unknown as Game;
}

export function toSave(g: Game): string {
  return JSON.stringify(g);
}

// Of two saves, keep the newer one
export function newer(a: Game | null, b: Game | null): Game | null {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export function loadLocal(): Game | null {
  try {
    return parseSave(localStorage.getItem(LOCAL_KEY));
  } catch {
    return null;
  }
}
export function saveLocal(g: Game) {
  try {
    localStorage.setItem(LOCAL_KEY, toSave(g));
  } catch {
    // storage full or blocked: the cloud save still works
  }
}
export function clearLocal() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // nothing to do
  }
}
