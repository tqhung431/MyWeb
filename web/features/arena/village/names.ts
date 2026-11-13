// Stage 24 · Giữ Làng: names shown in menus (translated where shown, with t()).
import { tx } from "@/lib/i18n/core";
import type { Branch, MapId, SpiritKind, TowerKind } from "./village";

export const MAP_NAMES: Record<MapId, string> = { riverside: tx("Riverside"), terraces: tx("Terraces"), festival: tx("Night Festival") };
export const TOWER_INFO: Record<TowerKind, { name: string; about: string; emoji: string; branches: Record<Branch, string> }> = {
  archer: { name: tx("Bamboo archer"), about: tx("Fast single shots at walking spirits"), emoji: "🏹", branches: { a: tx("Rapid fire"), b: tx("Piercing arrows") } },
  lantern: { name: tx("Lantern post"), about: tx("Slows spirits in its light"), emoji: "🏮", branches: { a: tx("Wider light"), b: tx("Burns") } },
  drum: { name: tx("Temple drum"), about: tx("Stuns everything nearby every few seconds"), emoji: "🥁", branches: { a: tx("Louder"), b: tx("Longer stun") } },
  kite: { name: tx("Kite flyer"), about: tx("The only one that hits flying paper-cranes"), emoji: "🪁", branches: { a: tx("Twin kites"), b: tx("Long range") } },
  cart: { name: tx("Rice-cake cart"), about: tx("Earns extra coins after every wave"), emoji: "🛒", branches: { a: tx("Faster"), b: tx("Bigger") } },
};
export const SPIRIT_NAMES: Record<SpiritKind, string> = {
  fox: tx("Fox-wisp"),
  turtle: tx("Rock-turtle"),
  crane: tx("Paper-crane"),
  gourd: tx("Slime-gourd"),
  gourdlet: tx("Little gourd"),
  rabbit: tx("Moon-Rabbit of Mischief"),
};
