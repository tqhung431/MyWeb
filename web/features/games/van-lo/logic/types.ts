// The whole game state. It's plain data (no classes), so it can be saved as JSON and loaded back.

import type { Pos } from "../engine/grid";
import type { AbilityId, AllyKind, Element, EnemyKind, Hazard, ItemId, PathId, RealmId, Slot, Stats, TechniqueId, TreasureKind } from "./data";

export const SAVE_VERSION = 2; // Stage 17: paths, crafting, realms up to Nguyên Anh (v1 saves are upgraded in save.ts)

export type Lang = "vi" | "en";

export type Gear = { uid: string; slot: Slot; tier: number; level: number; quality: number; name: string; bonus: Partial<Stats> };
export type Treasure = { uid: string; kind: TreasureKind; grade: number; level: number };
export type Bag = Partial<Record<ItemId, number>>;

export type Craft = { level: number; xp: number };

export type Player = {
  name: string;
  path: PathId; // Stage 17: kiếm tu, võ giả, nho gia, đạo gia, phật gia or binh gia
  root: Element[]; // spiritual root: 1–4 elements
  major: number; // 0 = Luyện Khí, 1 = Trúc Cơ
  layer: number; // 1–9
  cultivation: number; // tu vi gathered towards the next layer
  hp: number;
  qi: number;
  intent: number; // the path's resource (kiếm ý, khí huyết, chính khí…), 0–10
  stones: number; // linh thạch (spirit stones)
  techniques: { id: TechniqueId; level: number }[];
  main: TechniqueId;
  side: TechniqueId[]; // up to 2, at 30% strength
  skills: AbilityId[]; // equipped thần thông
  treasures: Treasure[];
  bound: string[]; // treasure uids in use
  gear: Gear[];
  equipped: Partial<Record<Slot, string>>;
  bag: Bag;
  craft: { alchemy: Craft; forge: Craft; talisman: Craft }; // luyện đan, luyện khí, chế phù
  record: { runs: number; deaths: number; kills: number; deepest: number; tribulations: number; crafted: number };
};

export type StatusKind = "burn" | "stun" | "weak" | "shield" | "reflect" | "block" | "echo" | "empower" | "bless-atk" | "bless-def" | "regen";
export type Status = { kind: StatusKind; turns: number; value: number };

export type Enemy = {
  uid: string;
  kind: EnemyKind;
  level: number;
  pos: Pos;
  hp: number;
  maxHp: number;
  awake: boolean;
  status: Status[];
  cooldown: number;
};

export type ThingKind = "herb" | "chest" | "stairs" | "portal" | "trap" | "stones" | "hazard" | "urn" | "crate" | "shrine" | "merchant" | "deco";
// Stage 18: decorations that make a floor feel lived in (they don't block anything)
export type Deco =
  | "torch"
  | "lantern"
  | "bones"
  | "banner"
  | "statue"
  | "bush"
  | "crystal"
  | "rock"
  | "mushroom"
  | "flowers"
  | "coral"
  | "spear"
  | "skull"
  | "campfire";
export type Offer = { id: ItemId; price: number; sold?: boolean };
export type Thing = {
  uid: string;
  kind: ThingKind;
  pos: Pos;
  hidden?: boolean;
  amount?: number;
  hazard?: Hazard;
  deco?: Deco;
  used?: boolean; // a shrine you've prayed at
  offers?: Offer[]; // a merchant's goods
};
// Urns, crates and merchants stand in the way (you break urns and crates by walking into them)
export const BLOCKING: ThingKind[] = ["urn", "crate", "merchant"];

// Stage 17: soldiers and archers summoned by Binh gia
export type Ally = { uid: string; kind: AllyKind; pos: Pos; hp: number; maxHp: number; atk: number; def: number; turns: number };

export type Floor = {
  depth: number;
  w: number;
  h: number;
  tiles: string; // "#" wall, "." floor
  seen: string; // "1" = you've seen this tile
  things: Thing[];
  enemies: Enemy[];
  allies?: Ally[];
};

export type LogLine = { turn: number; text: string; tone?: "good" | "bad" | "info" | "loot" };

export type Run = {
  kind: "realm" | "tribulation";
  realm: RealmId;
  floor: Floor;
  pos: Pos;
  turn: number;
  cooldowns: Partial<Record<string, number>>; // ability ids and treasure uids
  status: Status[];
  loot: { stones: number; bag: Bag; gear: Gear[]; treasures: Treasure[]; cultivation: number; kills: number };
  log: LogLine[];
  // Tribulation only: which breakthrough, tiles about to be struck, turns survived
  from?: number; // the major realm you're breaking out of
  strikes?: Pos[];
  survived?: number;
  goal?: number;
  demon?: boolean;
  pill?: boolean;
};

export type Game = {
  v: number;
  seed: number;
  rng: number; // the random generator's state
  uid: number; // counter for new ids
  createdAt: number;
  updatedAt: number;
  lang: Lang;
  player: Player;
  run: Run | null;
  // The last thing that happened at home, shown once
  notice?: string;
};
