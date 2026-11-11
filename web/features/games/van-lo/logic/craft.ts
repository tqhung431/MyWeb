// Stage 17: the furnace (lò luyện) in your cave abode.
//   Luyện đan (alchemy): herbs + beast cores → pills. It can fail; skill makes it safer.
//   Luyện khí (forging): dark iron → a new piece of gear for your realm. Skill makes better quality.
//   Chế phù (talismans): talisman paper → talismans.
// Every craft gives the skill experience; levels go up after 3, 5, 7… crafts.

import { makeRng } from "../engine/rng";
import { ITEMS, MAJOR_REALMS, SLOTS, type ItemId, type Slot } from "./data";
import { addItem, bagSize, playerLevel, rollGear, useItem } from "./player";
import type { Craft, Game, Gear } from "./types";

export type CraftSkill = "alchemy" | "forge" | "talisman";
export const SKILLS: Record<CraftSkill, { vi: string; en: string }> = {
  alchemy: { vi: "Luyện đan", en: "Alchemy" },
  forge: { vi: "Luyện khí", en: "Forging" },
  talisman: { vi: "Chế phù", en: "Talismans" },
};

export type Recipe = {
  id: string;
  skill: CraftSkill;
  makes?: ItemId; // pills and talismans
  slot?: Slot; // forging
  needs: Partial<Record<ItemId, number>>;
  stones: number;
  minMajor: number;
};

const pill = (makes: ItemId, needs: Partial<Record<ItemId, number>>, stones: number, minMajor = 0): Recipe => ({
  id: makes,
  skill: "alchemy",
  makes,
  needs,
  stones,
  minMajor,
});
const charm = (makes: ItemId, needs: Partial<Record<ItemId, number>>, stones: number): Recipe => ({
  id: makes,
  skill: "talisman",
  makes,
  needs,
  stones,
  minMajor: 0,
});

export const RECIPES: Recipe[] = [
  pill("hoi-xuan", { "linh-thao": 2 }, 5),
  pill("hoi-linh", { "linh-thao": 2 }, 5),
  pill("tu-khi", { "linh-thao": 3, "yeu-dan": 1 }, 10),
  pill("truc-co-dan", { "linh-thao": 6, "yeu-dan": 3 }, 100),
  pill("dai-hoi-xuan", { "hoa-linh-chi": 2 }, 30, 1),
  pill("ket-kim-dan", { "hoa-linh-chi": 6, "yeu-dan": 4 }, 600, 1),
  pill("boi-nguyen", { "bang-tam-lien": 2, "yeu-dan": 1 }, 150, 2),
  pill("hoa-anh-dan", { "bang-tam-lien": 6, "u-hon-hoa": 1, "yeu-dan": 5 }, 2500, 2),
  charm("bao-linh-phu", { "phu-chi": 1, "yeu-dan": 1 }, 5),
  charm("truyen-tong-phu", { "phu-chi": 2, "linh-thao": 1 }, 10),
  ...(Object.keys(SLOTS) as Slot[]).map(
    (slot): Recipe => ({ id: `forge-${slot}`, skill: "forge", slot, needs: { "huyen-thiet": 2 }, stones: 30, minMajor: 0 }),
  ),
];

// Forging costs more stones at higher realms
export const recipeStones = (r: Recipe, major: number) => (r.skill === "forge" ? r.stones * (1 + major) ** 2 : r.stones);
export const successChance = (r: Recipe, c: Craft) => (r.skill === "forge" ? 1 : Math.min(0.95, (r.skill === "alchemy" ? 0.55 : 0.7) + 0.08 * (c.level - 1)));
export const xpToNext = (c: Craft) => 1 + 2 * c.level;

export function canCraft(g: Game, r: Recipe): { ok: boolean; reason?: "realm" | "materials" | "stones" | "bag" } {
  const p = g.player;
  if (p.major < r.minMajor) return { ok: false, reason: "realm" };
  if ((Object.entries(r.needs) as [ItemId, number][]).some(([id, n]) => (p.bag[id] ?? 0) < n)) return { ok: false, reason: "materials" };
  if (p.stones < recipeStones(r, p.major)) return { ok: false, reason: "stones" };
  if (r.skill === "forge" && p.gear.length >= bagSize(p)) return { ok: false, reason: "bag" };
  return { ok: true };
}

export type CraftResult = { ok: boolean; success?: boolean; item?: ItemId; gear?: Gear; levelUp?: boolean; reason?: string };

export function craft(g: Game, recipeId: string): CraftResult {
  const p = g.player;
  const r = RECIPES.find((x) => x.id === recipeId);
  if (!r) return { ok: false, reason: "unknown" };
  const check = canCraft(g, r);
  if (!check.ok) return { ok: false, reason: check.reason };
  const rng = makeRng(g.rng);
  const skill = p.craft[r.skill];
  for (const [id, n] of Object.entries(r.needs) as [ItemId, number][]) useItem(p, id, n);
  p.stones -= recipeStones(r, p.major);
  const success = rng.chance(successChance(r, skill));
  const out: CraftResult = { ok: true, success };
  if (success && r.makes) {
    addItem(p.bag, r.makes);
    out.item = r.makes;
  } else if (success && r.slot) {
    // A forged piece is a little above your level; a skilled smith makes better quality
    const gear = rollGear(g, rng, playerLevel(p) + 1, 0.06 * (skill.level - 1) + 0.1, r.slot);
    p.gear.push(gear);
    out.gear = gear;
  }
  skill.xp++;
  if (skill.xp >= xpToNext(skill)) {
    skill.xp = 0;
    skill.level++;
    out.levelUp = true;
  }
  p.record.crafted = (p.record.crafted ?? 0) + 1;
  g.rng = rng.state();
  return out;
}

export const recipeName = (r: Recipe, lang: "vi" | "en") =>
  r.makes
    ? lang === "vi"
      ? ITEMS[r.makes].vi
      : ITEMS[r.makes].en
    : lang === "vi"
      ? `Rèn ${SLOTS[r.slot!].vi.toLowerCase()}`
      : `Forge a ${SLOTS[r.slot!].en.toLowerCase()}`;
export const realmLabel = (major: number, lang: "vi" | "en") => (lang === "vi" ? MAJOR_REALMS[major].vi : MAJOR_REALMS[major].en);
