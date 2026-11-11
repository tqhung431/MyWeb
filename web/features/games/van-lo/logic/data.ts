// Vân Lộ: everything the game is made of, as plain data. Rules live in the other logic files.
// Names are our own; realm names, spiritual roots and the five elements are shared ideas of the genre.

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
  { vi: "Luyện Khí", en: "Qi Refining", layers: 9, skillSlots: 4, treasureSlots: 1 },
  { vi: "Trúc Cơ", en: "Foundation", layers: 9, skillSlots: 6, treasureSlots: 2 },
] as const;

// Base stats for a realm and layer, before methods, gear and treasures
export function realmStats(major: number, layer: number): Stats {
  if (major === 0) return { hp: 60 + 12 * layer, qi: 30 + 5 * layer, atk: 8 + 2 * layer, def: 3 + layer, crit: 5, qiRegen: 0.5 };
  return { hp: 220 + 25 * layer, qi: 90 + 10 * layer, atk: 30 + 4 * layer, def: 14 + 2 * layer, crit: 8, qiRegen: 1 };
}

// Tu vi (cultivation) needed to fill a layer
export function layerCost(major: number, layer: number) {
  return Math.round((major === 0 ? 60 : 900) * 1.35 ** (layer - 1));
}

// ---- Spiritual roots (linh căn): more elements = slower cultivation ----
export const ROOTS = [
  { count: 1, vi: "Thiên linh căn", en: "Heavenly root", speed: 1.6, chance: 0.1 },
  { count: 2, vi: "Song linh căn", en: "Dual root", speed: 1.25, chance: 0.3 },
  { count: 3, vi: "Tam linh căn", en: "Triple root", speed: 1, chance: 0.4 },
  { count: 4, vi: "Ngụy linh căn", en: "Mixed root", speed: 0.8, chance: 0.2 },
] as const;

// ---- Công pháp (cultivation methods) ----
export type TechniqueId = "thanh-phong" | "xich-diem" | "huyen-thuy";
export const TECHNIQUES: Record<
  TechniqueId,
  { vi: string; en: string; element: Element; grade: string; perLevel: Partial<Stats>; maxLevel: number; about: string; aboutEn: string }
> = {
  "thanh-phong": {
    vi: "Thanh Phong Kiếm Quyết",
    en: "Clear Wind Sword Art",
    element: "moc",
    grade: "Hoàng",
    perLevel: { atk: 2, hp: 6, crit: 1 },
    maxLevel: 5,
    about: "Kiếm quyết nhập môn, nhanh nhẹn như gió.",
    aboutEn: "A first sword art, quick as the wind.",
  },
  "xich-diem": {
    vi: "Xích Diễm Kiếm Kinh",
    en: "Crimson Flame Sword Canon",
    element: "hoa",
    grade: "Huyền",
    perLevel: { atk: 3.5, crit: 0.5 },
    maxLevel: 5,
    about: "Kiếm khí mang lửa, đánh mạnh nhưng hao linh lực.",
    aboutEn: "Sword qi wreathed in fire: strong, but hungry for qi.",
  },
  "huyen-thuy": {
    vi: "Huyền Thủy Kiếm Điển",
    en: "Dark Water Sword Codex",
    element: "thuy",
    grade: "Huyền",
    perLevel: { def: 1.5, hp: 10, qiRegen: 0.2 },
    maxLevel: 5,
    about: "Kiếm như nước: mềm mà bền, hồi linh lực nhanh.",
    aboutEn: "A sword like water: soft, lasting, quick to recover qi.",
  },
};
// Practising a level costs spirit stones and needs a high enough realm layer
export const practiseCost = (level: number) => 40 * level * level;
export const practiseNeeds = (level: number) => ({ major: 0, layer: Math.max(1, level * 2 - 1) });

// ---- Thần thông (divine abilities) ----
export type AbilityId = "kiem-khi" | "ngu-kiem" | "kiem-vu" | "luu-quang" | "liet-diem" | "boc-phat" | "ho-the" | "bang-tam";
export type Targeting = "self" | "line" | "enemy" | "area" | "adjacent" | "dash";
export const ABILITIES: Record<
  AbilityId,
  { vi: string; en: string; qi: number; cooldown: number; range: number; target: Targeting; from: [TechniqueId, number]; about: string; aboutEn: string }
> = {
  "kiem-khi": {
    vi: "Kiếm Khí Trảm",
    en: "Sword Qi Slash",
    qi: 4,
    cooldown: 0,
    range: 3,
    target: "line",
    from: ["thanh-phong", 1],
    about: "Chém một đường kiếm khí 3 ô, trúng mọi kẻ địch trên đường.",
    aboutEn: "A 3-tile line of sword qi that hits everyone on it.",
  },
  "ngu-kiem": {
    vi: "Ngự Kiếm Phi Hành",
    en: "Sword Flight",
    qi: 4,
    cooldown: 4,
    range: 4,
    target: "dash",
    from: ["thanh-phong", 2],
    about: "Cưỡi kiếm lướt tới 4 ô theo đường thẳng.",
    aboutEn: "Ride your sword up to 4 tiles in a straight line.",
  },
  "kiem-vu": {
    vi: "Kiếm Vũ",
    en: "Sword Rain",
    qi: 10,
    cooldown: 4,
    range: 4,
    target: "area",
    from: ["thanh-phong", 4],
    about: "Mưa kiếm rơi xuống vùng 3×3.",
    aboutEn: "Swords rain down on a 3×3 area.",
  },
  "luu-quang": {
    vi: "Lưu Quang Kiếm Ảnh",
    en: "Flowing Light Afterimage",
    qi: 6,
    cooldown: 6,
    range: 0,
    target: "self",
    from: ["thanh-phong", 5],
    about: "3 đòn đánh tiếp theo đánh hai lần.",
    aboutEn: "Your next 3 attacks strike twice.",
  },
  "liet-diem": {
    vi: "Liệt Diễm Kiếm",
    en: "Blazing Sword",
    qi: 6,
    cooldown: 2,
    range: 1,
    target: "adjacent",
    from: ["xich-diem", 1],
    about: "Đòn kiếm lửa, thiêu đốt kẻ địch 3 lượt.",
    aboutEn: "A fiery strike that burns for 3 turns.",
  },
  "boc-phat": {
    vi: "Kiếm Ý Bộc Phát",
    en: "Sword Intent Burst",
    qi: 3,
    cooldown: 3,
    range: 1,
    target: "adjacent",
    from: ["xich-diem", 3],
    about: "Dùng hết kiếm ý: mỗi điểm thêm 25% sát thương.",
    aboutEn: "Spend all sword intent: +25% damage per point.",
  },
  "ho-the": {
    vi: "Hộ Thể Kiếm Cương",
    en: "Sword Aura Shield",
    qi: 6,
    cooldown: 5,
    range: 0,
    target: "self",
    from: ["huyen-thuy", 1],
    about: "Kiếm cương hộ thể, chặn sát thương trong 3 lượt.",
    aboutEn: "A shield of sword aura that absorbs damage for 3 turns.",
  },
  "bang-tam": {
    vi: "Băng Tâm Quyết",
    en: "Ice Heart Mantra",
    qi: 8,
    cooldown: 6,
    range: 0,
    target: "self",
    from: ["huyen-thuy", 3],
    about: "Hồi 25% sinh lực và giải trạng thái xấu.",
    aboutEn: "Heal 25% of your life and clear bad effects.",
  },
};

// ---- Pháp bảo (magic treasures) ----
export type TreasureKind = "thanh-hong" | "tran-hon" | "tu-kim" | "bat-quai" | "hoan-linh" | "huyen-quy";
export const TREASURE_GRADES = [
  { vi: "Pháp khí", en: "Artifact" },
  { vi: "Linh khí", en: "Spirit artifact" },
  { vi: "Pháp bảo", en: "Treasure" },
  { vi: "Linh bảo", en: "Spirit treasure" },
] as const;
export const TREASURES: Record<
  TreasureKind,
  { vi: string; en: string; passive: Partial<Stats>; cooldown: number; range: number; target: Targeting; about: string; aboutEn: string }
> = {
  "thanh-hong": {
    vi: "Thanh Hồng Kiếm",
    en: "Azure Rainbow Sword",
    passive: { atk: 3 },
    cooldown: 3,
    range: 6,
    target: "enemy",
    about: "Phi kiếm: bay tới đánh một kẻ địch trong tầm 6 ô.",
    aboutEn: "Flying sword: strikes one enemy up to 6 tiles away.",
  },
  "tran-hon": {
    vi: "Trấn Hồn Chung",
    en: "Soul-Calming Bell",
    passive: { def: 2 },
    cooldown: 7,
    range: 2,
    target: "self",
    about: "Tiếng chuông làm choáng mọi kẻ địch trong 2 ô.",
    aboutEn: "Its ring stuns every enemy within 2 tiles.",
  },
  "tu-kim": {
    vi: "Tử Kim Hồ Lô",
    en: "Purple-Gold Gourd",
    passive: { qi: 8 },
    cooldown: 8,
    range: 0,
    target: "self",
    about: "Hồi 30% linh lực.",
    aboutEn: "Restores 30% of your qi.",
  },
  "bat-quai": {
    vi: "Bát Quái Kính",
    en: "Eight Trigram Mirror",
    passive: { def: 1, qi: 4 },
    cooldown: 8,
    range: 0,
    target: "self",
    about: "Phản lại 40% sát thương trong 3 lượt.",
    aboutEn: "Reflects 40% of damage for 3 turns.",
  },
  "hoan-linh": {
    vi: "Hoán Linh Phiên",
    en: "Spirit-Calling Banner",
    passive: { crit: 1.5 },
    cooldown: 6,
    range: 3,
    target: "self",
    about: "Kẻ địch trong 3 ô yếu đi: giảm phòng ngự 3 lượt.",
    aboutEn: "Enemies within 3 tiles lose defence for 3 turns.",
  },
  "huyen-quy": {
    vi: "Huyền Quy Thuẫn",
    en: "Black Tortoise Shield",
    passive: { hp: 15 },
    cooldown: 6,
    range: 0,
    target: "self",
    about: "Chặn trọn đòn đánh kế tiếp.",
    aboutEn: "Fully blocks the next hit.",
  },
};
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
// 5 bases per slot, from tier 0 (floor 1) to tier 4
export const GEAR_BASES: Record<Slot, string[]> = {
  robe: ["Vải Thô Đạo Bào", "Thanh Vân Bào", "Huyền Văn Bào", "Tử Hà Pháp Y", "Lưu Vân Tiên Y"],
  belt: ["Đai Da Thú", "Đai Ngọc Bích", "Đai Linh Tơ", "Đai Bạch Hổ Bì", "Đai Lưu Ly"],
  boots: ["Giày Cỏ", "Giày Thanh Bố", "Giày Truy Phong", "Giày Đạp Vân", "Giày Lăng Ba"],
  ring: ["Nhẫn Gỗ Đào", "Nhẫn Đồng Xanh", "Nhẫn Bạch Ngọc", "Nhẫn Huyền Thiết", "Nhẫn Càn Khôn"],
  pendant: ["Ngọc Bội Thô", "Ngọc Bội Thanh Tâm", "Ngọc Bội Hộ Thân", "Ngọc Bội Tụ Linh", "Ngọc Bội Thái Hư"],
};
export const QUALITIES = [
  { vi: "Phàm", en: "Common", color: "#7a7468", affixes: 0 },
  { vi: "Linh", en: "Spirit", color: "#3f7d4b", affixes: 1 },
  { vi: "Huyền", en: "Profound", color: "#2f5f9a", affixes: 2 },
  { vi: "Địa", en: "Earth", color: "#7a3fa0", affixes: 3 },
] as const;
// Extra random bonuses a piece can roll, per tier
export const AFFIXES: { stat: keyof Stats; perTier: number }[] = [
  { stat: "atk", perTier: 1.5 },
  { stat: "def", perTier: 1 },
  { stat: "hp", perTier: 8 },
  { stat: "qi", perTier: 4 },
  { stat: "crit", perTier: 1.2 },
  { stat: "qiRegen", perTier: 0.12 },
];
export const BAG_BASE = 12; // pieces of gear you can carry; a storage ring adds 4 per tier

// ---- Items (đan dược, phù lục, materials) ----
export type ItemId = "hoi-xuan" | "hoi-linh" | "tu-khi" | "truc-co-dan" | "bao-linh-phu" | "truyen-tong-phu" | "yeu-dan" | "ngoc-gian-xd" | "ngoc-gian-ht";
export const ITEMS: Record<
  ItemId,
  { vi: string; en: string; kind: "pill" | "talisman" | "material" | "scroll"; price: number; about: string; aboutEn: string }
> = {
  "hoi-xuan": { vi: "Hồi Xuân Đan", en: "Spring Pill", kind: "pill", price: 30, about: "Hồi 40% sinh lực.", aboutEn: "Heals 40% of your life." },
  "hoi-linh": { vi: "Hồi Linh Đan", en: "Qi Pill", kind: "pill", price: 30, about: "Hồi 50% linh lực.", aboutEn: "Restores 50% of your qi." },
  "tu-khi": { vi: "Tụ Khí Đan", en: "Gathering Pill", kind: "pill", price: 60, about: "Tăng 60 tu vi.", aboutEn: "+60 cultivation." },
  "truc-co-dan": {
    vi: "Trúc Cơ Đan",
    en: "Foundation Pill",
    kind: "pill",
    price: 400,
    about: "Dùng khi độ kiếp Trúc Cơ: thêm 30% sinh lực và một lá chắn.",
    aboutEn: "For the Foundation tribulation: +30% life and a shield.",
  },
  "bao-linh-phu": {
    vi: "Bạo Linh Phù",
    en: "Burst Talisman",
    kind: "talisman",
    price: 40,
    about: "Nổ tung vùng 3×3 quanh một kẻ địch (sát thương cố định).",
    aboutEn: "Blasts a 3×3 area around an enemy (fixed damage).",
  },
  "truyen-tong-phu": {
    vi: "Truyền Tống Phù",
    en: "Return Talisman",
    kind: "talisman",
    price: 80,
    about: "Lập tức về động phủ, giữ lại chiến lợi phẩm.",
    aboutEn: "Go home at once, keeping your loot.",
  },
  "yeu-dan": { vi: "Yêu Đan", en: "Beast Core", kind: "material", price: 15, about: "Dùng để tế luyện pháp bảo.", aboutEn: "Used to refine treasures." },
  "ngoc-gian-xd": {
    vi: "Ngọc giản: Xích Diễm",
    en: "Jade slip: Crimson Flame",
    kind: "scroll",
    price: 300,
    about: "Học Xích Diễm Kiếm Kinh.",
    aboutEn: "Learn the Crimson Flame Sword Canon.",
  },
  "ngoc-gian-ht": {
    vi: "Ngọc giản: Huyền Thủy",
    en: "Jade slip: Dark Water",
    kind: "scroll",
    price: 300,
    about: "Học Huyền Thủy Kiếm Điển.",
    aboutEn: "Learn the Dark Water Sword Codex.",
  },
};

// ---- Enemies ----
export type EnemyKind = "lang" | "xa" | "hung" | "hon" | "ta-tu" | "buc" | "mang-vuong" | "tam-ma";
export const ENEMIES: Record<
  EnemyKind,
  {
    vi: string;
    en: string;
    hp: number;
    atk: number;
    def: number;
    range: number; // 1 = bites; more = shoots
    fast?: boolean; // moves twice every other turn
    drains?: boolean; // hits drain qi
    flees?: boolean; // runs away when hurt
    ghost?: boolean; // floats through walls
    beast?: boolean; // drops beast cores
    boss?: boolean;
  }
> = {
  lang: { vi: "Thiết Bối Lang", en: "Iron-back Wolf", hp: 1, atk: 1, def: 0.8, range: 1, fast: true, beast: true },
  xa: { vi: "Hỏa Văn Xà", en: "Flame-pattern Snake", hp: 0.8, atk: 0.9, def: 0.6, range: 3, beast: true },
  hung: { vi: "Thạch Giáp Hùng", en: "Stone-armour Bear", hp: 1.9, atk: 1.15, def: 1.8, range: 1, beast: true },
  hon: { vi: "Âm Hồn", en: "Wandering Spirit", hp: 0.7, atk: 0.8, def: 0.3, range: 1, drains: true, ghost: true },
  "ta-tu": { vi: "Tà Tu", en: "Rogue Cultivator", hp: 1.1, atk: 1.1, def: 1, range: 4, flees: true },
  buc: { vi: "Huyết Bức", en: "Blood Bat", hp: 0.45, atk: 0.7, def: 0.3, range: 1, fast: true, beast: true },
  "mang-vuong": { vi: "Xích Giác Mãng Vương", en: "Red-horned Python King", hp: 7, atk: 1.5, def: 1.6, range: 2, beast: true, boss: true },
  "tam-ma": { vi: "Tâm Ma", en: "Heart Demon", hp: 1, atk: 1, def: 1, range: 1, drains: true },
};
export const enemyStats = (kind: EnemyKind, level: number) => {
  const e = ENEMIES[kind];
  return { hp: Math.round((20 + 8 * level) * e.hp), atk: (5 + 2.2 * level) * e.atk, def: (1 + 0.8 * level) * e.def };
};

// ---- Secret realms (bí cảnh) ----
export const SECRET_REALMS = {
  "vu-an-coc": {
    vi: "Vụ Ẩn Cốc",
    en: "Mist-hidden Valley",
    floors: 5,
    about: "Thung lũng sương mù, nơi yêu thú và tà tu ẩn nấp. Ở tầng sâu nhất có Mãng Vương canh giữ.",
    aboutEn: "A misty valley where beasts and rogue cultivators hide. A python king guards the deepest floor.",
    enemies: [
      ["lang", "buc", "xa"],
      ["lang", "xa", "hon", "buc"],
      ["xa", "hon", "ta-tu", "hung"],
      ["ta-tu", "hung", "hon", "lang"],
      ["hung", "ta-tu", "xa", "hon"],
    ] as EnemyKind[][],
  },
} as const;
export type RealmId = keyof typeof SECRET_REALMS;
