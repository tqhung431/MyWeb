// Vân Lộ: everything the game is made of, as plain data. Rules live in the other logic files.
// Paths, methods, abilities and treasures are in paths.ts (re-exported here).
// Names are our own; realm names, spiritual roots and the five elements are shared ideas of the genre.

import type { PathId, TechniqueId } from "./paths";
import type { Deco } from "./types";
import { TECHNIQUES } from "./paths";
export * from "./paths";

export type Element = "kim" | "moc" | "thuy" | "hoa" | "tho";
export type Stats = { hp: number; qi: number; atk: number; def: number; crit: number; qiRegen: number };
export const NO_STATS: Stats = { hp: 0, qi: 0, atk: 0, def: 0, crit: 0, qiRegen: 0 };

export const ELEMENTS: Record<Element, { vi: string; en: string; color: string }> = {
  kim: { vi: "Kim", en: "Metal", color: "#b59a4a" },
  moc: { vi: "Mộc", en: "Wood", color: "#4f8a4b" },
  thuy: { vi: "Thủy", en: "Water", color: "#3f6f9a" },
  hoa: { vi: "Hỏa", en: "Fire", color: "#b8432f" },
  tho: { vi: "Thổ", en: "Earth", color: "#8a6a3f" },
};

// ---- Realms (cảnh giới) ----
export const MAJOR_REALMS = [
  { vi: "Luyện Khí", en: "Qi Refining", layers: 9, skillSlots: 4, treasureSlots: 1, pill: "truc-co-dan" },
  { vi: "Trúc Cơ", en: "Foundation", layers: 9, skillSlots: 5, treasureSlots: 2, pill: "ket-kim-dan" },
  { vi: "Kết Đan", en: "Golden Core", layers: 9, skillSlots: 6, treasureSlots: 2, pill: "hoa-anh-dan" },
  { vi: "Nguyên Anh", en: "Nascent Soul", layers: 9, skillSlots: 7, treasureSlots: 3, pill: null },
] as const;
export const TOP_MAJOR = MAJOR_REALMS.length - 1;

// Your place on the whole ladder: Luyện Khí 1 = 1 … Nguyên Anh 9 = 36
export const realmIndex = (major: number, layer: number) => major * 9 + layer;

// How much stronger things get past Luyện Khí: ×1.12 per layer, plus a jump at each breakthrough.
// Players and enemies use the same curve, so the fights stay about as hard at every realm.
export const curve = (level: number) => (level <= 9 ? 1 : 1.12 ** (level - 9));
export const powerScale = (major: number, layer: number) => curve(realmIndex(major, layer)) * 1.15 ** major;

// Base stats for a realm and layer, before methods, gear and treasures
export function realmStats(major: number, layer: number): Stats {
  if (major === 0) return { hp: 60 + 12 * layer, qi: 30 + 5 * layer, atk: 8 + 2 * layer, def: 3 + layer, crit: 5, qiRegen: 0.5 };
  const R = realmIndex(major, layer);
  const c = curve(R);
  return {
    hp: 168 * 1.115 ** (R - 9) * 1.2 ** major,
    qi: (75 + 9 * (R - 9)) * 1.1 ** major,
    atk: 26 * c * 1.15 ** major,
    def: 12 * c * 1.15 ** major,
    crit: 5 + 3 * major,
    qiRegen: 0.5 + 0.6 * major,
  };
}

// Tu vi (cultivation) needed to fill a layer
const LAYER_BASE = [60, 400, 9600, 160000];
export function layerCost(major: number, layer: number) {
  return Math.round(LAYER_BASE[major] * 1.35 ** (layer - 1));
}

// Meditation: stones per sitting, and tu vi gained (before your root's speed)
export const MEDITATION = [
  { stones: 10, gain: 30 },
  { stones: 30, gain: 120 },
  { stones: 120, gain: 660 },
  { stones: 400, gain: 3300 },
];

// ---- Spiritual roots (linh căn): more elements = slower cultivation ----
export const ROOTS = [
  { count: 1, vi: "Thiên linh căn", en: "Heavenly root", speed: 1.6, chance: 0.1 },
  { count: 2, vi: "Song linh căn", en: "Dual root", speed: 1.25, chance: 0.3 },
  { count: 3, vi: "Tam linh căn", en: "Triple root", speed: 1, chance: 0.4 },
  { count: 4, vi: "Ngụy linh căn", en: "Mixed root", speed: 0.8, chance: 0.2 },
] as const;

// Practising a method level costs spirit stones and needs a high enough realm layer
export const practiseCost = (level: number) => 40 * level * level;
export const practiseNeeds = (level: number) => ({ major: 0, layer: Math.max(1, level * 2 - 1) });

// ---- Pháp bảo grades ----
export const TREASURE_GRADES = [
  { vi: "Pháp khí", en: "Artifact" },
  { vi: "Linh khí", en: "Spirit artifact" },
  { vi: "Pháp bảo", en: "Treasure" },
  { vi: "Linh bảo", en: "Spirit treasure" },
] as const;
// A treasure's passive grows with its refine level (1–10) and grade
export const treasureScale = (grade: number, level: number) => (1 + grade) * (1 + (level - 1) * 0.25);
export const refineCost = (grade: number, level: number) => ({ stones: 30 * (grade + 1) * level, cores: 1 + Math.floor(level / 3) + grade });
export const upgradeCost = (grade: number) => ({ stones: 250 * (grade + 1), cores: 5 * (grade + 1) });

// ---- Trang bị (equipment) ----
export type Slot = "robe" | "belt" | "boots" | "ring" | "pendant";
export const SLOTS: Record<Slot, { vi: string; en: string; base: Partial<Stats> }> = {
  robe: { vi: "Đạo bào", en: "Robe", base: { def: 2, hp: 8 } },
  belt: { vi: "Đai lưng", en: "Belt", base: { hp: 10, qi: 4 } },
  boots: { vi: "Giày", en: "Boots", base: { def: 1, qiRegen: 0.15 } },
  ring: { vi: "Trữ vật giới", en: "Storage ring", base: { qi: 5, atk: 1 } },
  pendant: { vi: "Ngọc bội", en: "Jade pendant", base: { crit: 1.5, hp: 4 } },
};
// 5 bases per slot, from tier 0 to tier 4 (tier follows the item's level)
export const GEAR_BASES: Record<Slot, string[]> = {
  robe: ["Vải Thô Đạo Bào", "Thanh Vân Bào", "Huyền Văn Bào", "Tử Hà Pháp Y", "Lưu Vân Tiên Y"],
  belt: ["Đai Da Thú", "Đai Ngọc Bích", "Đai Linh Tơ", "Đai Bạch Hổ Bì", "Đai Lưu Ly"],
  boots: ["Giày Cỏ", "Giày Thanh Bố", "Giày Truy Phong", "Giày Đạp Vân", "Giày Lăng Ba"],
  ring: ["Nhẫn Gỗ Đào", "Nhẫn Đồng Xanh", "Nhẫn Bạch Ngọc", "Nhẫn Huyền Thiết", "Nhẫn Càn Khôn"],
  pendant: ["Ngọc Bội Thô", "Ngọc Bội Thanh Tâm", "Ngọc Bội Hộ Thân", "Ngọc Bội Tụ Linh", "Ngọc Bội Thái Hư"],
};
export const gearTier = (level: number) => Math.max(0, Math.min(4, Math.floor((level - 1) / 9)));
// How strong gear of an (enemy) level is: grows like everything else past level 10
export const gearPower = (level: number) => (level <= 10 ? 1 + 0.35 * level : 4.5 * 1.12 ** (level - 10));
export const QUALITIES = [
  { vi: "Phàm", en: "Common", color: "#7a7468", affixes: 0 },
  { vi: "Linh", en: "Spirit", color: "#3f7d4b", affixes: 1 },
  { vi: "Huyền", en: "Profound", color: "#2f5f9a", affixes: 2 },
  { vi: "Địa", en: "Earth", color: "#7a3fa0", affixes: 3 },
] as const;
// Extra random bonuses a piece can roll, per unit of gear power
export const AFFIXES: { stat: keyof Stats; perTier: number }[] = [
  { stat: "atk", perTier: 1.5 },
  { stat: "def", perTier: 1 },
  { stat: "hp", perTier: 8 },
  { stat: "qi", perTier: 4 },
  { stat: "crit", perTier: 1.2 },
  { stat: "qiRegen", perTier: 0.12 },
];
export const BAG_BASE = 12; // pieces of gear you can carry; a storage ring adds 4 per tier

// ---- Items (đan dược, phù lục, materials, jade slips) ----
type BaseItemId =
  | "hoi-xuan"
  | "hoi-linh"
  | "tu-khi"
  | "dai-hoi-xuan"
  | "boi-nguyen"
  | "truc-co-dan"
  | "ket-kim-dan"
  | "hoa-anh-dan"
  | "bao-linh-phu"
  | "truyen-tong-phu"
  | "yeu-dan"
  | "linh-thao"
  | "hoa-linh-chi"
  | "bang-tam-lien"
  | "u-hon-hoa"
  | "huyen-thiet"
  | "phu-chi";
export type SlipId = `slip-${TechniqueId}`;
export type ItemId = BaseItemId | SlipId;
export type ItemKind = "pill" | "talisman" | "material" | "scroll";
export type ItemInfo = { vi: string; en: string; kind: ItemKind; price: number; minMajor?: number; about: string; aboutEn: string };

const BASE_ITEMS: Record<BaseItemId, ItemInfo> = {
  "hoi-xuan": { vi: "Hồi Xuân Đan", en: "Spring Pill", kind: "pill", price: 30, about: "Hồi 40% sinh lực.", aboutEn: "Heals 40% of your life." },
  "hoi-linh": { vi: "Hồi Linh Đan", en: "Qi Pill", kind: "pill", price: 30, about: "Hồi 50% linh lực.", aboutEn: "Restores 50% of your qi." },
  "tu-khi": {
    vi: "Tụ Khí Đan",
    en: "Gathering Pill",
    kind: "pill",
    price: 60,
    about: "Tăng tu vi (bằng 2 lần tọa thiền).",
    aboutEn: "Cultivation worth two sittings of meditation.",
  },
  "dai-hoi-xuan": {
    vi: "Đại Hồi Xuân Đan",
    en: "Great Spring Pill",
    kind: "pill",
    price: 200,
    minMajor: 1,
    about: "Hồi 75% sinh lực.",
    aboutEn: "Heals 75% of your life.",
  },
  "boi-nguyen": {
    vi: "Bồi Nguyên Đan",
    en: "Root-nourishing Pill",
    kind: "pill",
    price: 900,
    minMajor: 2,
    about: "Tăng 20% tu vi của tầng hiện tại.",
    aboutEn: "+20% of your current layer's cultivation.",
  },
  "truc-co-dan": {
    vi: "Trúc Cơ Đan",
    en: "Foundation Pill",
    kind: "pill",
    price: 400,
    about: "Dùng khi độ kiếp Trúc Cơ: thêm sinh lực và một lá chắn.",
    aboutEn: "For the Foundation tribulation: life and a shield.",
  },
  "ket-kim-dan": {
    vi: "Kết Kim Đan",
    en: "Golden Core Pill",
    kind: "pill",
    price: 3000,
    minMajor: 1,
    about: "Dùng khi độ kiếp Kết Đan.",
    aboutEn: "For the Golden Core tribulation.",
  },
  "hoa-anh-dan": {
    vi: "Hóa Anh Đan",
    en: "Soul-forming Pill",
    kind: "pill",
    price: 15000,
    minMajor: 2,
    about: "Dùng khi độ kiếp Nguyên Anh.",
    aboutEn: "For the Nascent Soul tribulation.",
  },
  "bao-linh-phu": {
    vi: "Bạo Linh Phù",
    en: "Burst Talisman",
    kind: "talisman",
    price: 40,
    about: "Nổ tung vùng 3×3 quanh một kẻ địch.",
    aboutEn: "Blasts a 3×3 area around an enemy.",
  },
  "truyen-tong-phu": {
    vi: "Truyền Tống Phù",
    en: "Return Talisman",
    kind: "talisman",
    price: 80,
    about: "Lập tức về động phủ, giữ lại chiến lợi phẩm.",
    aboutEn: "Go home at once, keeping your loot.",
  },
  "yeu-dan": {
    vi: "Yêu Đan",
    en: "Beast Core",
    kind: "material",
    price: 15,
    about: "Tế luyện pháp bảo, luyện đan, chế phù.",
    aboutEn: "For refining treasures, pills and talismans.",
  },
  "linh-thao": {
    vi: "Linh Thảo",
    en: "Spirit Herb",
    kind: "material",
    price: 8,
    about: "Thảo dược của Vụ Ẩn Cốc.",
    aboutEn: "A herb from the Mist-hidden Valley.",
  },
  "hoa-linh-chi": {
    vi: "Hỏa Linh Chi",
    en: "Fire Lingzhi",
    kind: "material",
    price: 40,
    about: "Nấm linh mọc cạnh dung nham.",
    aboutEn: "A lingzhi that grows by the lava.",
  },
  "bang-tam-lien": {
    vi: "Băng Tâm Liên",
    en: "Ice-heart Lotus",
    kind: "material",
    price: 160,
    about: "Sen trong hồ nước cổ.",
    aboutEn: "A lotus from the ancient pools.",
  },
  "u-hon-hoa": {
    vi: "U Hồn Hoa",
    en: "Ghostbloom",
    kind: "material",
    price: 600,
    about: "Hoa nở trên chiến trường xưa.",
    aboutEn: "A flower of the old battlefield.",
  },
  "huyen-thiet": {
    vi: "Huyền Thiết",
    en: "Dark Iron",
    kind: "material",
    price: 60,
    about: "Quặng để luyện khí (rèn trang bị).",
    aboutEn: "Ore for forging gear.",
  },
  "phu-chi": { vi: "Phù Chỉ", en: "Talisman Paper", kind: "material", price: 20, about: "Giấy vẽ bùa.", aboutEn: "Paper for drawing talismans." },
};

export const slipOf = (t: TechniqueId): SlipId => `slip-${t}`;
export const ITEMS = {
  ...BASE_ITEMS,
  ...Object.fromEntries(
    (Object.keys(TECHNIQUES) as TechniqueId[]).map((t) => [
      slipOf(t),
      {
        vi: `Ngọc giản: ${TECHNIQUES[t].vi}`,
        en: `Jade slip: ${TECHNIQUES[t].en}`,
        kind: "scroll",
        price: 300,
        about: `Học ${TECHNIQUES[t].vi}.`,
        aboutEn: `Learn the ${TECHNIQUES[t].en}.`,
      },
    ]),
  ),
} as Record<ItemId, ItemInfo>;

// ---- Enemies ----
export type Shape = "lang" | "xa" | "hung" | "hon" | "tu" | "buc" | "mang";
export type EnemyKind =
  | "lang"
  | "xa"
  | "hung"
  | "hon"
  | "ta-tu"
  | "buc"
  | "mang-vuong"
  | "tam-ma"
  | "hoa-linh"
  | "nham-ma"
  | "xich-tich"
  | "dan-ma"
  | "viem-giap"
  | "thuy-quy"
  | "lan-xa"
  | "giap-giai"
  | "hai-tu"
  | "bich-lan-giao"
  | "am-binh"
  | "cot-cung"
  | "oan-hon"
  | "thi-lang"
  | "ma-tuong";
export type EnemyInfo = {
  vi: string;
  en: string;
  shape: Shape;
  tint?: string; // ink colour (default: black ink)
  hp: number;
  atk: number;
  def: number;
  range: number; // 1 = bites; more = shoots
  fast?: boolean; // moves twice every other turn
  drains?: boolean; // hits drain qi
  burns?: boolean; // hits set you on fire
  flees?: boolean; // runs away when hurt
  ghost?: boolean; // floats through walls
  beast?: boolean; // drops beast cores
  boss?: boolean;
};
const e = (vi: string, en: string, shape: Shape, hp: number, atk: number, def: number, range: number, more: Partial<EnemyInfo> = {}): EnemyInfo => ({
  vi,
  en,
  shape,
  hp,
  atk,
  def,
  range,
  ...more,
});
export const ENEMIES: Record<EnemyKind, EnemyInfo> = {
  // Vụ Ẩn Cốc
  lang: e("Thiết Bối Lang", "Iron-back Wolf", "lang", 1, 1, 0.8, 1, { fast: true, beast: true }),
  xa: e("Hỏa Văn Xà", "Flame-pattern Snake", "xa", 0.8, 0.9, 0.6, 3, { beast: true }),
  hung: e("Thạch Giáp Hùng", "Stone-armour Bear", "hung", 1.9, 1.15, 1.8, 1, { beast: true }),
  hon: e("Âm Hồn", "Wandering Spirit", "hon", 0.7, 0.8, 0.3, 1, { drains: true, ghost: true }),
  "ta-tu": e("Tà Tu", "Rogue Cultivator", "tu", 1.1, 1.1, 1, 4, { flees: true, tint: "#3d3350" }),
  buc: e("Huyết Bức", "Blood Bat", "buc", 0.45, 0.7, 0.3, 1, { fast: true, beast: true }),
  "mang-vuong": e("Xích Giác Mãng Vương", "Red-horned Python King", "mang", 7, 1.5, 1.6, 2, { beast: true, boss: true }),
  "tam-ma": e("Tâm Ma", "Heart Demon", "tu", 1, 1, 1, 1, { drains: true, tint: "#5a0f0c" }),
  // Lưu Hỏa Nham Quật
  "hoa-linh": e("Hỏa Linh", "Fire Wisp", "hon", 0.7, 0.9, 0.4, 2, { burns: true, ghost: true, tint: "#d0662e" }),
  "nham-ma": e("Nham Ma", "Lava Golem", "hung", 2.1, 1.1, 2, 1, { burns: true, tint: "#8a3320" }),
  "xich-tich": e("Xích Tích", "Ember Salamander", "xa", 0.9, 1, 0.8, 3, { beast: true, tint: "#b8432f" }),
  "dan-ma": e("Đan Ma", "Rogue Alchemist", "tu", 1.1, 1.2, 0.9, 4, { flees: true, burns: true, tint: "#7a2f1d" }),
  "viem-giap": e("Viêm Giáp Thú Vương", "Flame-armoured Beast King", "hung", 7, 1.5, 1.8, 1, { boss: true, beast: true, burns: true, tint: "#a8231b" }),
  // Bích Hải Di Tích
  "thuy-quy": e("Thủy Quỷ", "Drowned Ghost", "hon", 0.8, 0.9, 0.4, 1, { drains: true, ghost: true, tint: "#2f7d7a" }),
  "lan-xa": e("Lân Xà", "Scaled Serpent", "xa", 1, 1, 0.9, 3, { beast: true, tint: "#2f5f9a" }),
  "giap-giai": e("Thiết Giáp Giải", "Iron-shell Crab", "hung", 2, 1, 2.3, 1, { beast: true, tint: "#3f5f6a" }),
  "hai-tu": e("Hải Tặc Tu Sĩ", "Sea-raider Cultivator", "tu", 1.1, 1.15, 1, 4, { flees: true, tint: "#1f4f6a" }),
  "bich-lan-giao": e("Bích Lân Giao", "Jade-scaled Flood Dragon", "mang", 7.5, 1.5, 1.7, 3, { boss: true, beast: true, tint: "#1f6f6a" }),
  // Cổ Chiến Trường
  "am-binh": e("Âm Binh", "Ghost Soldier", "tu", 1.3, 1.1, 1.3, 1, { tint: "#4a4a5a" }),
  "cot-cung": e("Cốt Cung Thủ", "Bone Archer", "tu", 0.9, 1.15, 0.7, 5, { tint: "#8a8170" }),
  "oan-hon": e("Oán Hồn", "Grudge Wraith", "hon", 0.8, 1, 0.4, 1, { drains: true, ghost: true, tint: "#5a3f7a" }),
  "thi-lang": e("Thi Lang", "Corpse Wolf", "lang", 1, 1.05, 0.9, 1, { fast: true, beast: true, tint: "#3a3a3a" }),
  "ma-tuong": e("Tàn Hồn Ma Tướng", "Broken-soul Demon General", "tu", 8, 1.55, 1.8, 2, { boss: true, drains: true, tint: "#4a0f14" }),
};
export const SPIRITS: EnemyKind[] = ["hon", "hoa-linh", "thuy-quy", "oan-hon", "tam-ma"];

// Enemy stats by level: as before up to level 10, then the shared growth curve
export const enemyStats = (kind: EnemyKind, level: number) => {
  const k = ENEMIES[kind];
  const base =
    level <= 10
      ? { hp: 20 + 8 * level, atk: 5 + 2.2 * level, def: 1 + 0.8 * level }
      : { hp: 100 * 1.12 ** (level - 10), atk: 27 * 1.12 ** (level - 10), def: 9 * 1.12 ** (level - 10) };
  return { hp: Math.round(base.hp * k.hp), atk: base.atk * k.atk, def: base.def * k.def };
};
// What a defeated enemy gives: tu vi always, spirit stones sometimes
export const tuviFor = (level: number) => Math.round(level <= 10 ? 6 + 4 * level : 46 * 1.22 ** (level - 10));
export const stonesFor = (level: number) => Math.round(level <= 10 ? 2 + 2 * level : 22 * 1.15 ** (level - 10));

// ---- Secret realms (bí cảnh) ----
export type Hazard = "lava" | "whirlpool" | "miasma";
export type RealmInfo = {
  vi: string;
  en: string;
  floors: number;
  minMajor: number;
  firstLevel: number; // enemy level on floor 1 (+2 per floor)
  boss: { kind: EnemyKind; level: number };
  herb: ItemId;
  hazard: Hazard | null;
  paper: { light: string; dark: string }; // tint of the map
  decos: Deco[]; // Stage 18: what decorates its floors
  about: string;
  aboutEn: string;
  enemies: EnemyKind[][]; // per floor (the last list repeats)
};
export const SECRET_REALMS = {
  "vu-an-coc": {
    vi: "Vụ Ẩn Cốc",
    en: "Mist-hidden Valley",
    floors: 5,
    minMajor: 0,
    firstLevel: 1,
    boss: { kind: "mang-vuong", level: 10 },
    herb: "linh-thao",
    hazard: null,
    paper: { light: "#f3ecdc", dark: "#1b1915" },
    decos: ["bush", "flowers", "rock", "mushroom", "torch", "lantern", "statue", "bones"],
    about: "Thung lũng sương mù, nơi yêu thú và tà tu ẩn nấp. Ở tầng sâu nhất có Mãng Vương canh giữ.",
    aboutEn: "A misty valley where beasts and rogue cultivators hide. A python king guards the deepest floor.",
    enemies: [
      ["lang", "buc", "xa"],
      ["lang", "xa", "hon", "buc"],
      ["xa", "hon", "ta-tu", "hung"],
      ["ta-tu", "hung", "hon", "lang"],
      ["hung", "ta-tu", "xa", "hon"],
    ],
  },
  "luu-hoa": {
    vi: "Lưu Hỏa Nham Quật",
    en: "Flowing-fire Caverns",
    floors: 6,
    minMajor: 1,
    firstLevel: 10,
    boss: { kind: "viem-giap", level: 22 },
    herb: "hoa-linh-chi",
    hazard: "lava",
    paper: { light: "#f1e2d3", dark: "#211612" },
    decos: ["rock", "crystal", "campfire", "bones", "skull", "torch", "mushroom"],
    about: "Hang động dung nham chảy như sông. Coi chừng vũng lửa; Viêm Giáp Thú Vương ngủ ở đáy.",
    aboutEn: "Caves where lava runs like rivers. Mind the fire pools; a flame-armoured king sleeps at the bottom.",
    enemies: [
      ["hoa-linh", "xich-tich", "lang"],
      ["hoa-linh", "xich-tich", "nham-ma"],
      ["xich-tich", "nham-ma", "dan-ma"],
      ["nham-ma", "dan-ma", "hoa-linh"],
      ["dan-ma", "nham-ma", "xich-tich", "hoa-linh"],
    ],
  },
  "bich-hai": {
    vi: "Bích Hải Di Tích",
    en: "Jade Sea Ruins",
    floors: 7,
    minMajor: 2,
    firstLevel: 19,
    boss: { kind: "bich-lan-giao", level: 33 },
    herb: "bang-tam-lien",
    hazard: "whirlpool",
    paper: { light: "#e6efec", dark: "#101b1c" },
    decos: ["coral", "crystal", "rock", "statue", "lantern", "bones"],
    about: "Di tích tông môn cổ chìm dưới biển. Xoáy nước cuốn bạn đi nơi khác; Bích Lân Giao canh giữ đáy biển.",
    aboutEn: "An ancient sect's ruins under the sea. Whirlpools sweep you away; a jade-scaled dragon guards the depths.",
    enemies: [
      ["thuy-quy", "lan-xa", "giap-giai"],
      ["lan-xa", "giap-giai", "hai-tu"],
      ["thuy-quy", "hai-tu", "giap-giai", "lan-xa"],
    ],
  },
  "co-chien": {
    vi: "Cổ Chiến Trường",
    en: "Ancient Battlefield",
    floors: 7,
    minMajor: 3,
    firstLevel: 28,
    boss: { kind: "ma-tuong", level: 42 },
    herb: "u-hon-hoa",
    hazard: "miasma",
    paper: { light: "#e9e6ea", dark: "#17141a" },
    decos: ["spear", "skull", "bones", "banner", "campfire", "statue", "torch"],
    about: "Chiến trường vạn năm, oán khí chưa tan. Âm binh vẫn còn đánh trận; Ma Tướng đứng giữa xương trắng.",
    aboutEn: "A battlefield ten thousand years old, still full of grudges. Ghost soldiers fight on; a demon general waits among the bones.",
    enemies: [
      ["am-binh", "thi-lang", "cot-cung"],
      ["am-binh", "oan-hon", "cot-cung"],
      ["oan-hon", "am-binh", "cot-cung", "thi-lang"],
    ],
  },
} satisfies Record<string, RealmInfo>;
export type RealmId = keyof typeof SECRET_REALMS;
export const REALM_IDS = Object.keys(SECRET_REALMS) as RealmId[];
export const realmInfo = (id: RealmId): RealmInfo => SECRET_REALMS[id];

export const pathOfTechnique = (t: TechniqueId): PathId => TECHNIQUES[t].path;
