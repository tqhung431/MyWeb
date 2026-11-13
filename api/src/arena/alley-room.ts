// Stage 23 · Ngõ Pháo: the room around a match. Before the match: seats, colours, hats, "ready", how many bots,
// which map. Plain data + functions again; server.ts wires them to Socket.IO.

import * as A from "./alley.js";

export const COLORS = 4; // red, jade, gold, violet (drawn by the browser)
export const HATS = 5; // none, nón lá (leaf hat), cat ears, ribbon, little dragon horns
const BOT_NAMES = ["Bé Pháo", "Kẹo Dừa", "Mèo Mướp", "Bánh Tét"];

export type Person = { id: string; name: string };
export type AlleySeat = Person & { color: number; hat: number; ready: boolean };
export type AlleyLobby = {
  hostId: string | null;
  map: A.MapId | "random";
  bots: number;
  seats: AlleySeat[];
  game: A.AlleyGame | null;
  saved: boolean;
  lastStep: number;
  away: Set<string>; // seated people whose browser is gone (a bot plays for them meanwhile)
};

export function newLobby(host: Person): AlleyLobby {
  return { hostId: host.id, map: "random", bots: 2, seats: [], game: null, saved: false, lastStep: 0, away: new Set() };
}

const freeColor = (l: AlleyLobby) => [0, 1, 2, 3].find((c) => !l.seats.some((s) => s.color === c)) ?? 0;

/** Take a seat (before the match starts, if one is free). Returns false = you watch. */
export function sit(l: AlleyLobby, p: Person): boolean {
  if (l.seats.some((s) => s.id === p.id)) return true;
  if (l.game || l.seats.length >= 4) return false;
  l.seats.push({ ...p, color: freeColor(l), hat: 0, ready: false });
  l.bots = Math.min(l.bots, 4 - l.seats.length);
  if (!l.hostId) l.hostId = p.id;
  return true;
}

export function standUp(l: AlleyLobby, id: string) {
  l.seats = l.seats.filter((s) => s.id !== id);
  if (l.hostId === id) l.hostId = l.seats[0]?.id ?? null;
}

export function look(l: AlleyLobby, id: string, color: number, hat: number): string | null {
  const s = l.seats.find((x) => x.id === id);
  if (!s) return "Take a seat first";
  if (l.seats.some((x) => x.id !== id && x.color === color)) return "Someone already has that colour";
  s.color = color;
  s.hat = hat;
  return null;
}

export function setReady(l: AlleyLobby, id: string, ready: boolean) {
  const s = l.seats.find((x) => x.id === id);
  if (s) s.ready = ready;
}

export function settings(l: AlleyLobby, id: string, change: { bots?: number; map?: A.MapId | "random" }): string | null {
  if (id !== l.hostId) return "Only the host can change this";
  if (l.game) return "The match has started";
  if (change.bots !== undefined) l.bots = Math.max(0, Math.min(change.bots, 4 - l.seats.length));
  if (change.map) l.map = change.map;
  return null;
}

export function canStart(l: AlleyLobby, id: string): string | null {
  if (id !== l.hostId) return "Only the host can start";
  if (l.game) return "The match has started";
  if (l.seats.length + l.bots < 2) return "Add a bot or wait for a friend";
  if (l.seats.some((s) => s.id !== l.hostId && !s.ready)) return "Not everyone is ready";
  return null;
}

export function start(l: AlleyLobby, now: number, seed: number) {
  const players: A.Seat[] = l.seats.map((s) => ({ id: s.id, name: s.name, color: s.color, hat: s.hat, bot: l.away.has(s.id) }));
  const taken = new Set(players.map((p) => p.color));
  for (let i = 0; i < l.bots; i++) {
    const color = [0, 1, 2, 3].find((c) => !taken.has(c))!;
    taken.add(color);
    players.push({ id: `bot:${i + 1}`, name: BOT_NAMES[i], color, hat: (i + 1) % HATS, bot: true });
  }
  const map = l.map === "random" ? A.MAP_IDS[seed % A.MAP_IDS.length] : l.map;
  l.game = A.newAlleyMatch(players, map, seed, now);
  l.saved = false;
  l.lastStep = now;
}

/** After a match: back to the lobby, keeping everyone who's still here */
export function again(l: AlleyLobby, id: string): string | null {
  if (id !== l.hostId) return "Only the host can do this";
  if (l.game?.phase !== "matchEnd") return "The match isn't over";
  l.game = null;
  for (const gone of l.away) standUp(l, gone);
  l.away.clear();
  for (const s of l.seats) s.ready = false;
  return null;
}

/** Your browser is gone mid-match: a bot plays for you. Back again: you play. */
export function setAway(l: AlleyLobby, id: string, away: boolean) {
  if (away) l.away.add(id);
  else l.away.delete(id);
  const p = l.game?.players.find((x) => x.id === id);
  if (p) {
    p.bot = away;
    if (!away) p.dir = 0;
  }
}

export function lobbyView(l: AlleyLobby) {
  return { hostId: l.hostId, map: l.map, bots: l.bots, seats: l.seats, playing: !!l.game, away: [...l.away] };
}
