// Stage 17: the six cultivation paths (đạo lộ), their methods (công pháp), abilities (thần thông) and treasures (pháp bảo).
//
// Every ability and every treasure power is described with the same small set of fields (an `Effect`),
// and one function in world.ts carries them out. Adding an ability = adding data here, no new code.
// Paths are real schools of Chinese thought, used as genre inspiration; every name below is our own.

import type { Element, Stats } from "./data";

export type PathId = "kiem" | "vo" | "nho" | "dao" | "phat" | "binh";

export const PATHS: Record<
  PathId,
  {
    vi: string;
    en: string;
    color: string;
    about: string;
    aboutEn: string;
    resource: { vi: string; en: string; about: string; aboutEn: string };
    start: TechniqueId;
    treasure: TreasureKind;
  }
> = {
  kiem: {
    vi: "Kiếm tu",
    en: "Sword cultivator",
    color: "#4f8a9a",
    about: "Sát thương cao, phi kiếm đánh xa. Mạnh dần theo từng nhát kiếm.",
    aboutEn: "High damage, flying swords from afar. Grows stronger with every strike.",
    resource: { vi: "Kiếm ý", en: "Sword intent", about: "+1 mỗi đòn trúng; mỗi điểm +3% sát thương.", aboutEn: "+1 per hit; each point +3% damage." },
    start: "thanh-phong",
    treasure: "thanh-hong",
  },
  vo: {
    vi: "Võ giả",
    en: "Martial artist",
    color: "#8a6a3f",
    about: "Luyện thể, chịu đòn giỏi, phản đòn khi bị đánh gần.",
    aboutEn: "Tempers the body: takes hits well and strikes back up close.",
    resource: {
      vi: "Khí huyết",
      en: "Blood vigour",
      about: "+2 khi trúng đòn, +1 khi đánh trúng; mỗi điểm +2% phòng thủ. 20% phản đòn.",
      aboutEn: "+2 when hit, +1 when you hit; each point +2% defence. 20% counter-attack.",
    },
    start: "kim-cang",
    treasure: "kim-cang-sao",
  },
  nho: {
    vi: "Nho gia",
    en: "Confucian scholar",
    color: "#3f7d4b",
    about: "Viết chữ thành phép: định thân, hộ thể, khống chế cả trận.",
    aboutEn: "Written characters become rules: bind, protect, control the field.",
    resource: {
      vi: "Chính khí",
      en: "Righteous qi",
      about: "+1 mỗi lượt; mỗi điểm giảm 2.5% sát thương phải nhận và +3% uy lực thần thông.",
      aboutEn: "+1 every turn; each point cuts damage taken by 2.5% and adds 3% ability power.",
    },
    start: "hao-nhien",
    treasure: "van-xuong",
  },
  dao: {
    vi: "Đạo gia",
    en: "Taoist",
    color: "#7a3fa0",
    about: "Phù lục và trận pháp, ngũ hành tương sinh. Thần thông càng dùng càng mạnh.",
    aboutEn: "Talismans and formations of the five elements. Abilities grow with use.",
    resource: {
      vi: "Đạo vận",
      en: "Dao charm",
      about: "+1 mỗi lần thi triển thần thông; mỗi điểm +2.5% uy lực thần thông.",
      aboutEn: "+1 per ability used; each point +2.5% ability power.",
    },
    start: "ngu-hanh",
    treasure: "ngu-loi-lenh",
  },
  phat: {
    vi: "Phật gia",
    en: "Buddhist",
    color: "#b08a2e",
    about: "Hồi phục, kim thân hộ thể, nhân quả báo ứng phản sát thương.",
    aboutEn: "Healing, a golden body, and karma that returns harm to its sender.",
    resource: {
      vi: "Công đức",
      en: "Merit",
      about: "+1 khi hạ địch hoặc hồi phục; mỗi điểm phản 2% sát thương.",
      aboutEn: "+1 per defeat or heal; each point reflects 2% of damage.",
    },
    start: "dai-bi",
    treasure: "tu-kim-bat",
  },
  binh: {
    vi: "Binh gia",
    en: "Strategist",
    color: "#a8231b",
    about: "Điểm binh, bày trận: triệu hồi binh sĩ và cung thủ chiến đấu cùng.",
    aboutEn: "Summons soldiers and archers, and commands the field.",
    resource: {
      vi: "Quân lệnh",
      en: "Command",
      about: "+1 mỗi 2 lượt; mỗi điểm +5% sức đánh của binh sĩ.",
      aboutEn: "+1 every 2 turns; each point +5% to your soldiers' attacks.",
    },
    start: "binh-thu",
    treasure: "ho-phu",
  },
};
export const MAX_RESOURCE = 10;

// ---- Công pháp ----
export type TechniqueId =
  | "thanh-phong"
  | "xich-diem"
  | "huyen-thuy"
  | "kim-cang"
  | "long-ho"
  | "hao-nhien"
  | "le-nhac"
  | "ngu-hanh"
  | "thai-at"
  | "dai-bi"
  | "kim-than"
  | "binh-thu"
  | "tran-phap";

type Technique = {
  path: PathId;
  vi: string;
  en: string;
  element: Element;
  grade: string;
  perLevel: Partial<Stats>;
  maxLevel: number;
  about: string;
  aboutEn: string;
};
const tech = (path: PathId, vi: string, en: string, element: Element, grade: string, perLevel: Partial<Stats>, about: string, aboutEn: string): Technique => ({
  path,
  vi,
  en,
  element,
  grade,
  perLevel,
  maxLevel: 5,
  about,
  aboutEn,
});

export const TECHNIQUES: Record<TechniqueId, Technique> = {
  "thanh-phong": tech(
    "kiem",
    "Thanh Phong Kiếm Quyết",
    "Clear Wind Sword Art",
    "moc",
    "Hoàng",
    { atk: 2, hp: 6, crit: 1 },
    "Kiếm quyết nhập môn, nhanh nhẹn như gió.",
    "A first sword art, quick as the wind.",
  ),
  "xich-diem": tech(
    "kiem",
    "Xích Diễm Kiếm Kinh",
    "Crimson Flame Sword Canon",
    "hoa",
    "Huyền",
    { atk: 3.5, crit: 0.5 },
    "Kiếm khí mang lửa, đánh mạnh nhưng hao linh lực.",
    "Sword qi wreathed in fire: strong, but hungry for qi.",
  ),
  "huyen-thuy": tech(
    "kiem",
    "Huyền Thủy Kiếm Điển",
    "Dark Water Sword Codex",
    "thuy",
    "Huyền",
    { def: 1.5, hp: 10, qiRegen: 0.2 },
    "Kiếm như nước: mềm mà bền, hồi linh lực nhanh.",
    "A sword like water: soft, lasting, quick to recover qi.",
  ),
  "kim-cang": tech(
    "vo",
    "Kim Cương Luyện Thể Quyết",
    "Diamond Body Forging",
    "kim",
    "Hoàng",
    { atk: 0.5, hp: 14, def: 1.5 },
    "Tôi luyện da thịt cứng như kim cương.",
    "Temper skin and bone until they are hard as diamond.",
  ),
  "long-ho": tech(
    "vo",
    "Long Hổ Bá Thể",
    "Dragon-Tiger Overlord Body",
    "tho",
    "Huyền",
    { atk: 3, hp: 12 },
    "Sức như rồng, thế như hổ.",
    "The strength of a dragon, the stance of a tiger.",
  ),
  "hao-nhien": tech(
    "nho",
    "Hạo Nhiên Chính Khí Quyết",
    "Vast Righteous Qi Art",
    "moc",
    "Hoàng",
    { atk: 2.2, qi: 6, def: 1, qiRegen: 0.15 },
    "Dưỡng khí hạo nhiên giữa trời đất.",
    "Nurture the vast, upright qi between heaven and earth.",
  ),
  "le-nhac": tech(
    "nho",
    "Lễ Nhạc Tâm Kinh",
    "Rites and Music Heart Canon",
    "kim",
    "Huyền",
    { atk: 3.8, crit: 0.8 },
    "Lễ để định, nhạc để hòa: chữ viết thành phép.",
    "Rites bring order, music brings harmony: words become law.",
  ),
  "ngu-hanh": tech(
    "dao",
    "Ngũ Hành Phù Lục Chân Giải",
    "True Commentary on Five-Element Talismans",
    "hoa",
    "Hoàng",
    { atk: 2, qi: 4 },
    "Vẽ bùa gọi lửa, gọi sấm.",
    "Draw talismans that call fire and thunder.",
  ),
  "thai-at": tech(
    "dao",
    "Thái Ất Trận Đồ",
    "Supreme Unity Formation Charts",
    "thuy",
    "Huyền",
    { qi: 6, def: 1, qiRegen: 0.2 },
    "Bày trận vây khốn, lấy tĩnh chế động.",
    "Lay formations that trap; let stillness overcome motion.",
  ),
  "dai-bi": tech(
    "phat",
    "Đại Bi Tâm Kinh",
    "Great Compassion Heart Sutra",
    "thuy",
    "Hoàng",
    { hp: 10, qiRegen: 0.2, def: 0.5 },
    "Lòng từ bi chữa lành thương tích.",
    "Compassion that heals every wound.",
  ),
  "kim-than": tech(
    "phat",
    "Kim Thân Quyết",
    "Golden Body Mantra",
    "tho",
    "Huyền",
    { def: 2, hp: 8 },
    "Kim thân bất hoại, nhân quả tự báo.",
    "An unbreakable golden body; karma answers for itself.",
  ),
  "binh-thu": tech(
    "binh",
    "Binh Thư Yếu Lược",
    "Essentials of the Art of War",
    "kim",
    "Hoàng",
    { atk: 2.4, hp: 8 },
    "Biết người biết ta, điểm binh xuất trận.",
    "Know the enemy and yourself; call your troops to battle.",
  ),
  "tran-phap": tech(
    "binh",
    "Trận Pháp Tâm Đắc",
    "Insights on Battle Formations",
    "tho",
    "Huyền",
    { def: 1.5, hp: 10, crit: 0.5 },
    "Thế trận như nước: xung phong, vây hãm.",
    "Formations flow like water: charge, then surround.",
  ),
};

// ---- Effects: what an ability or a treasure power does ----
export type Targeting = "self" | "around" | "line" | "enemy" | "area" | "adjacent" | "dash";
export type EnemyStatus = { kind: "burn" | "stun" | "weak"; turns: number; atk?: number }; // burn: atk × your attack per turn
export type SelfStatus = { kind: "shield" | "reflect" | "echo" | "block" | "empower"; turns: number; value: number };
export type AllyKind = "binh-si" | "cung-thu";

export type Effect = {
  target: Targeting;
  range: number; // how far you can aim (line/dash: how far it goes)
  radius?: number; // area / around: how wide
  mult?: number; // damage, × your attack
  enemy?: EnemyStatus[];
  self?: SelfStatus[]; // shield value: × (2 × defence + 10 + 10% life); reflect: %; echo: extra hits; empower: × next hit
  heal?: number; // part of your life
  qi?: number; // part of your qi
  spendAll?: boolean; // uses all of your path resource…
  perPoint?: number; // …for this much extra damage (or reflect) per point
  gain?: number; // path resource gained
  summon?: { kind: AllyKind; count: number };
  finish?: number; // dash, then strike the enemy where you land (× attack)
  spirits?: number; // extra damage multiplier against spirits
};

// ---- Thần thông ----
export type AbilityId =
  | "kiem-khi"
  | "ngu-kiem"
  | "kiem-vu"
  | "luu-quang"
  | "liet-diem"
  | "boc-phat"
  | "ho-the"
  | "bang-tam"
  | "bang-son"
  | "thiet-bo"
  | "ho-khieu"
  | "huyet-chien"
  | "dinh-tu"
  | "ho-tu"
  | "xuan-thu"
  | "chinh-khi"
  | "hoa-phu"
  | "ngu-loi"
  | "khon-tran"
  | "am-duong"
  | "cam-lo"
  | "phat-quang"
  | "kim-chung"
  | "nhan-qua"
  | "diem-binh"
  | "cung-no"
  | "xung-phong"
  | "thien-quan";

export type Ability = Effect & { vi: string; en: string; qi: number; cooldown: number; from: [TechniqueId, number]; about: string; aboutEn: string };
const ab = (vi: string, en: string, from: [TechniqueId, number], qi: number, cooldown: number, effect: Effect, about: string, aboutEn: string): Ability => ({
  vi,
  en,
  from,
  qi,
  cooldown,
  ...effect,
  about,
  aboutEn,
});

export const ABILITIES: Record<AbilityId, Ability> = {
  // Kiếm tu
  "kiem-khi": ab(
    "Kiếm Khí Trảm",
    "Sword Qi Slash",
    ["thanh-phong", 1],
    4,
    0,
    { target: "line", range: 3, mult: 1.3 },
    "Chém một đường kiếm khí 3 ô, trúng mọi kẻ địch trên đường.",
    "A 3-tile line of sword qi that hits everyone on it.",
  ),
  "ngu-kiem": ab(
    "Ngự Kiếm Phi Hành",
    "Sword Flight",
    ["thanh-phong", 2],
    4,
    4,
    { target: "dash", range: 4 },
    "Cưỡi kiếm lướt tới 4 ô theo đường thẳng.",
    "Ride your sword up to 4 tiles in a straight line.",
  ),
  "kiem-vu": ab(
    "Kiếm Vũ",
    "Sword Rain",
    ["thanh-phong", 4],
    10,
    4,
    { target: "area", range: 4, radius: 1, mult: 0.9 },
    "Mưa kiếm rơi xuống vùng 3×3.",
    "Swords rain down on a 3×3 area.",
  ),
  "luu-quang": ab(
    "Lưu Quang Kiếm Ảnh",
    "Flowing Light Afterimage",
    ["thanh-phong", 5],
    6,
    6,
    { target: "self", range: 0, self: [{ kind: "echo", turns: 12, value: 3 }] },
    "3 đòn đánh tiếp theo đánh hai lần.",
    "Your next 3 attacks strike twice.",
  ),
  "liet-diem": ab(
    "Liệt Diễm Kiếm",
    "Blazing Sword",
    ["xich-diem", 1],
    6,
    2,
    { target: "adjacent", range: 1, mult: 1.2, enemy: [{ kind: "burn", turns: 3, atk: 0.25 }] },
    "Đòn kiếm lửa, thiêu đốt kẻ địch 3 lượt.",
    "A fiery strike that burns for 3 turns.",
  ),
  "boc-phat": ab(
    "Kiếm Ý Bộc Phát",
    "Sword Intent Burst",
    ["xich-diem", 3],
    3,
    3,
    { target: "adjacent", range: 1, mult: 1, spendAll: true, perPoint: 0.25 },
    "Dùng hết kiếm ý: mỗi điểm thêm 25% sát thương.",
    "Spend all sword intent: +25% damage per point.",
  ),
  "ho-the": ab(
    "Hộ Thể Kiếm Cương",
    "Sword Aura Shield",
    ["huyen-thuy", 1],
    6,
    5,
    { target: "self", range: 0, self: [{ kind: "shield", turns: 3, value: 1 }] },
    "Kiếm cương hộ thể, chặn sát thương trong 3 lượt.",
    "A shield of sword aura that absorbs damage for 3 turns.",
  ),
  "bang-tam": ab(
    "Băng Tâm Quyết",
    "Ice Heart Mantra",
    ["huyen-thuy", 3],
    8,
    6,
    { target: "self", range: 0, heal: 0.25 },
    "Hồi 25% sinh lực.",
    "Heal 25% of your life.",
  ),
  // Võ giả
  "bang-son": ab(
    "Băng Sơn Quyền",
    "Mountain-crushing Fist",
    ["kim-cang", 1],
    4,
    2,
    { target: "adjacent", range: 1, mult: 1.6, enemy: [{ kind: "stun", turns: 1 }], gain: 1 },
    "Một quyền như núi đổ: choáng kẻ địch 1 lượt.",
    "A fist like a falling mountain: stuns for a turn.",
  ),
  "thiet-bo": ab(
    "Thiết Bố Sam",
    "Iron Shirt",
    ["kim-cang", 3],
    5,
    6,
    { target: "self", range: 0, self: [{ kind: "shield", turns: 4, value: 1.6 }] },
    "Thân như áo sắt: lá chắn lớn 4 lượt.",
    "Skin like an iron shirt: a big shield for 4 turns.",
  ),
  "ho-khieu": ab(
    "Hổ Khiếu",
    "Tiger's Roar",
    ["long-ho", 1],
    5,
    4,
    { target: "around", range: 0, radius: 2, mult: 0.5, enemy: [{ kind: "weak", turns: 3 }] },
    "Tiếng hổ gầm: kẻ địch trong 2 ô yếu đi.",
    "A roar that weakens every enemy within 2 tiles.",
  ),
  "huyet-chien": ab(
    "Huyết Chiến Bộc Phát",
    "Blood-war Burst",
    ["long-ho", 3],
    2,
    3,
    { target: "adjacent", range: 1, mult: 1.2, spendAll: true, perPoint: 0.3 },
    "Dồn hết khí huyết vào một đòn: mỗi điểm +30%.",
    "Pour all your vigour into one blow: +30% per point.",
  ),
  // Nho gia
  "dinh-tu": ab(
    "Định Tự Quyết",
    "Binding Word",
    ["hao-nhien", 1],
    5,
    3,
    { target: "enemy", range: 5, mult: 0.9, enemy: [{ kind: "stun", turns: 2 }] },
    "Viết chữ «Định»: kẻ địch đứng yên 2 lượt.",
    "Write the word 'Still': an enemy freezes for 2 turns.",
  ),
  "ho-tu": ab(
    "Hộ Tự Quyết",
    "Guarding Word",
    ["hao-nhien", 3],
    5,
    5,
    { target: "self", range: 0, self: [{ kind: "shield", turns: 3, value: 1.2 }], gain: 1 },
    "Chữ «Hộ» hiện quanh thân: lá chắn 3 lượt.",
    "The word 'Guard' circles you: a shield for 3 turns.",
  ),
  "xuan-thu": ab(
    "Xuân Thu Bút Pháp",
    "Spring-Autumn Brushwork",
    ["le-nhac", 1],
    5,
    1,
    { target: "line", range: 5, mult: 1.7 },
    "Một nét bút dài 5 ô, chữ nào cũng sắc như kiếm.",
    "One 5-tile brushstroke; every word cuts like a blade.",
  ),
  "chinh-khi": ab(
    "Thiên Địa Chính Khí",
    "Righteousness of Heaven and Earth",
    ["le-nhac", 3],
    6,
    4,
    { target: "around", range: 0, radius: 2, mult: 1.1, spendAll: true, perPoint: 0.15 },
    "Dùng hết chính khí: quét sạch tà khí quanh 2 ô.",
    "Spend all righteous qi to sweep evil from 2 tiles around.",
  ),
  // Đạo gia
  "hoa-phu": ab(
    "Hỏa Phù",
    "Fire Talisman",
    ["ngu-hanh", 1],
    5,
    1,
    { target: "enemy", range: 5, mult: 1.15, enemy: [{ kind: "burn", turns: 3, atk: 0.2 }] },
    "Phóng bùa lửa vào một kẻ địch, thiêu 3 lượt.",
    "Throw a fire talisman: it burns for 3 turns.",
  ),
  "ngu-loi": ab(
    "Ngũ Lôi Chính Pháp",
    "Five Thunders Rite",
    ["ngu-hanh", 3],
    10,
    4,
    { target: "area", range: 5, radius: 1, mult: 1.1, enemy: [{ kind: "stun", turns: 1 }] },
    "Gọi năm đạo sấm xuống vùng 3×3, làm choáng.",
    "Call five thunderbolts on a 3×3 area; they stun.",
  ),
  "khon-tran": ab(
    "Khốn Trận",
    "Trapping Formation",
    ["thai-at", 1],
    7,
    5,
    {
      target: "area",
      range: 4,
      radius: 1,
      mult: 0.3,
      enemy: [
        { kind: "weak", turns: 3 },
        { kind: "stun", turns: 1 },
      ],
    },
    "Bày trận vây khốn: kẻ địch trong trận yếu đi và đứng yên.",
    "A trapping formation: enemies inside weaken and freeze.",
  ),
  "am-duong": ab(
    "Âm Dương Quy Nhất",
    "Yin and Yang as One",
    ["thai-at", 3],
    4,
    3,
    { target: "enemy", range: 5, mult: 1, spendAll: true, perPoint: 0.3 },
    "Dùng hết đạo vận: mỗi điểm +30% vào một mục tiêu.",
    "Spend all dao charm: +30% per point on one target.",
  ),
  // Phật gia
  "cam-lo": ab(
    "Cam Lộ",
    "Sweet Dew",
    ["dai-bi", 1],
    6,
    4,
    { target: "self", range: 0, heal: 0.3, gain: 1 },
    "Giọt cam lộ hồi 30% sinh lực.",
    "Sweet dew heals 30% of your life.",
  ),
  "phat-quang": ab(
    "Phật Quang Phổ Chiếu",
    "Buddha Light",
    ["dai-bi", 3],
    8,
    3,
    { target: "around", range: 0, radius: 3, mult: 0.9, spirits: 2 },
    "Ánh Phật quang quanh 3 ô; gấp đôi với ma hồn.",
    "Holy light 3 tiles around; double against spirits.",
  ),
  "kim-chung": ab(
    "Kim Chung Tráo",
    "Golden Bell",
    ["kim-than", 1],
    6,
    6,
    {
      target: "self",
      range: 0,
      self: [
        { kind: "block", turns: 99, value: 1 },
        { kind: "shield", turns: 3, value: 0.8 },
      ],
    },
    "Chuông vàng bao thân: chặn trọn một đòn và thêm lá chắn.",
    "A golden bell: blocks one hit fully and adds a shield.",
  ),
  "nhan-qua": ab(
    "Nhân Quả Luân Hồi",
    "Wheel of Karma",
    ["kim-than", 3],
    4,
    6,
    { target: "self", range: 0, self: [{ kind: "reflect", turns: 4, value: 20 }], spendAll: true, perPoint: 10 },
    "Dùng hết công đức: phản 20% + 10%/điểm sát thương 4 lượt.",
    "Spend all merit: reflect 20% + 10% per point for 4 turns.",
  ),
  // Binh gia
  "diem-binh": ab(
    "Điểm Binh",
    "Muster Troops",
    ["binh-thu", 1],
    8,
    6,
    { target: "self", range: 0, summon: { kind: "binh-si", count: 2 } },
    "Gọi 2 binh sĩ chiến đấu bên bạn.",
    "Call 2 soldiers to fight beside you.",
  ),
  "cung-no": ab(
    "Cung Nỏ Trận",
    "Crossbow Line",
    ["binh-thu", 3],
    10,
    7,
    { target: "self", range: 0, summon: { kind: "cung-thu", count: 2 } },
    "Gọi 2 cung thủ bắn từ xa.",
    "Call 2 archers who shoot from afar.",
  ),
  "xung-phong": ab(
    "Xung Phong",
    "Charge",
    ["tran-phap", 1],
    5,
    4,
    { target: "dash", range: 4, finish: 1.3 },
    "Lao tới 4 ô và đánh kẻ địch nơi dừng chân.",
    "Charge up to 4 tiles and strike where you stop.",
  ),
  "thien-quan": ab(
    "Thiên Quân Vạn Mã",
    "Thousand Riders",
    ["tran-phap", 3],
    8,
    5,
    { target: "area", range: 5, radius: 2, mult: 0.6, spendAll: true, perPoint: 0.12 },
    "Dùng hết quân lệnh: vạn mã giẫm nát vùng 5×5.",
    "Spend all command: riders trample a 5×5 area.",
  ),
};

// ---- Pháp bảo ----
export type TreasureKind =
  | "thanh-hong"
  | "tran-hon"
  | "tu-kim"
  | "bat-quai"
  | "hoan-linh"
  | "huyen-quy"
  | "kim-cang-sao"
  | "van-xuong"
  | "ngu-loi-lenh"
  | "tu-kim-bat"
  | "ho-phu";

export type TreasureInfo = Effect & { vi: string; en: string; passive: Partial<Stats>; cooldown: number; about: string; aboutEn: string };
const tr = (vi: string, en: string, passive: Partial<Stats>, cooldown: number, effect: Effect, about: string, aboutEn: string): TreasureInfo => ({
  vi,
  en,
  passive,
  cooldown,
  ...effect,
  about,
  aboutEn,
});

export const TREASURES: Record<TreasureKind, TreasureInfo> = {
  "thanh-hong": tr(
    "Thanh Hồng Kiếm",
    "Azure Rainbow Sword",
    { atk: 3 },
    3,
    { target: "enemy", range: 6, mult: 1.2 },
    "Phi kiếm: bay tới đánh một kẻ địch trong tầm 6 ô.",
    "Flying sword: strikes one enemy up to 6 tiles away.",
  ),
  "tran-hon": tr(
    "Trấn Hồn Chung",
    "Soul-Calming Bell",
    { def: 2 },
    7,
    { target: "around", range: 0, radius: 2, enemy: [{ kind: "stun", turns: 1 }] },
    "Tiếng chuông làm choáng mọi kẻ địch trong 2 ô.",
    "Its ring stuns every enemy within 2 tiles.",
  ),
  "tu-kim": tr("Tử Kim Hồ Lô", "Purple-Gold Gourd", { qi: 8 }, 8, { target: "self", range: 0, qi: 0.3 }, "Hồi 30% linh lực.", "Restores 30% of your qi."),
  "bat-quai": tr(
    "Bát Quái Kính",
    "Eight Trigram Mirror",
    { def: 1, qi: 4 },
    8,
    { target: "self", range: 0, self: [{ kind: "reflect", turns: 3, value: 40 }] },
    "Phản lại 40% sát thương trong 3 lượt.",
    "Reflects 40% of damage for 3 turns.",
  ),
  "hoan-linh": tr(
    "Hoán Linh Phiên",
    "Spirit-Calling Banner",
    { crit: 1.5 },
    6,
    { target: "around", range: 0, radius: 3, enemy: [{ kind: "weak", turns: 3 }] },
    "Kẻ địch trong 3 ô yếu đi: giảm phòng ngự 3 lượt.",
    "Enemies within 3 tiles lose defence for 3 turns.",
  ),
  "huyen-quy": tr(
    "Huyền Quy Thuẫn",
    "Black Tortoise Shield",
    { hp: 15 },
    6,
    { target: "self", range: 0, self: [{ kind: "block", turns: 99, value: 1 }] },
    "Chặn trọn đòn đánh kế tiếp.",
    "Fully blocks the next hit.",
  ),
  "kim-cang-sao": tr(
    "Kim Cang Quyền Sáo",
    "Diamond Knuckles",
    { atk: 2, def: 1.5 },
    5,
    { target: "self", range: 0, self: [{ kind: "empower", turns: 5, value: 2 }] },
    "Đòn đánh kế tiếp mạnh gấp đôi.",
    "Your next hit is twice as strong.",
  ),
  "van-xuong": tr(
    "Văn Xương Bút",
    "Literary Star Brush",
    { qi: 6, crit: 1 },
    5,
    { target: "enemy", range: 5, mult: 0.9, enemy: [{ kind: "stun", turns: 2 }] },
    "Điểm một nét: kẻ địch đứng yên 2 lượt.",
    "One stroke: an enemy freezes for 2 turns.",
  ),
  "ngu-loi-lenh": tr(
    "Ngũ Lôi Lệnh Bài",
    "Five Thunders Token",
    { atk: 2 },
    5,
    { target: "area", range: 5, radius: 1, mult: 1 },
    "Lệnh bài gọi sấm xuống vùng 3×3.",
    "The token calls thunder on a 3×3 area.",
  ),
  "tu-kim-bat": tr(
    "Tử Kim Bát",
    "Purple-Gold Alms Bowl",
    { hp: 12, def: 1 },
    6,
    { target: "self", range: 0, heal: 0.2 },
    "Hồi 20% sinh lực.",
    "Heals 20% of your life.",
  ),
  "ho-phu": tr(
    "Hổ Phù",
    "Tiger Tally",
    { atk: 1, hp: 10 },
    8,
    { target: "self", range: 0, summon: { kind: "binh-si", count: 1 } },
    "Binh phù gọi một binh sĩ tinh nhuệ.",
    "The tally calls one elite soldier.",
  ),
};

export const ALLIES: Record<AllyKind, { vi: string; en: string; hp: number; atk: number; range: number; turns: number }> = {
  "binh-si": { vi: "Binh sĩ", en: "Soldier", hp: 0.4, atk: 0.45, range: 1, turns: 25 },
  "cung-thu": { vi: "Cung thủ", en: "Archer", hp: 0.25, atk: 0.4, range: 4, turns: 25 },
};

export const techniquesOf = (path: PathId) => (Object.keys(TECHNIQUES) as TechniqueId[]).filter((t) => TECHNIQUES[t].path === path);
export const abilitiesOf = (path: PathId) => (Object.keys(ABILITIES) as AbilityId[]).filter((a) => TECHNIQUES[ABILITIES[a].from[0]].path === path);
