// Stage 26 · Mầm Thú: the island of Thanh Khê. Six areas from the fishing village to the windy peak, each with tall
// grass where wild sproutlings live, a shrine (heals your team; grown-up forms happen here) and a shrine keeper who
// opens the way on. Plain data and small helpers; the rules of battles are in sprout.ts.

import type { SpeciesId } from "./sprout";

export const MAP_W = 20;
export const MAP_H = 12;

// Tiles:  # tree/rock   ~ water   . ground   , tall grass   = path   H your house   S shrine   V villager
//         K shrine keeper   G gate (closed until the keeper is beaten)   < back to the previous area   f flowers
export const SOLID = new Set(["#", "~", "H", "S", "V", "K", "G"]);

export type Villager = { x: number; y: number; name: string; look: number; lines: string[] };
export type Area = {
  id: string;
  name: string; // Vietnamese
  en: string;
  theme: { ground: number; grass: number; tree: number; water: number; accent: number };
  rows: string[];
  wild: { species: SpeciesId; weight: number }[];
  levels: [number, number];
  keeper: { name: string; title: string; team: [SpeciesId, number][]; before: string; after: string };
  villagers: Villager[];
  /** where you appear coming from the left (or at the start) */
  enter: [number, number];
};

const fit = (rows: string[]) => rows.map((r) => r.padEnd(MAP_W, "#").slice(0, MAP_W));

export const AREAS: Area[] = [
  {
    id: "village",
    name: "Làng Chài",
    en: "Fishing Village",
    theme: { ground: 0xcfe3a1, grass: 0x7fbf4d, tree: 0x3f8f4a, water: 0x5bb8e8, accent: 0xe0453a },
    rows: fit([
      "####################",
      "#~~~~~~~~..,,,,..###",
      "#~~~~~~~..,,,,,,..##",
      "#~~~~~....,,,,....f#",
      "#H......V..........#",
      "#.=======S=======K.G",
      "#..................G",
      "#..,,,,......,,,,..#",
      "#..,,,,,....,,,,,..#",
      "#f..,,,...V..,,,..f#",
      "#~~~~~~~~~~~~~~~~~~#",
      "####################",
    ]),
    wild: [
      { species: "giot", weight: 4 },
      { species: "cheo", weight: 3 },
      { species: "beo", weight: 2 },
    ],
    levels: [2, 4],
    keeper: {
      name: "Cô Mai",
      title: "Keeper of the Sea Shrine",
      team: [["cheo", 5], ["giot", 6]],
      before: "The sea shrine is awake again! Show me your sproutlings are happy, and the bamboo path is yours.",
      after: "Well done! The bamboo grove is through the gate. Its sproutlings are shy: be gentle.",
    },
    villagers: [
      { x: 8, y: 4, name: "Bác Tư", look: 0, lines: ["After the storm the seed-spirits scattered all over Clearwater Isle.", "Walk through the tall grass and you'll meet them. Be kind: knock one out and it runs home."] },
      { x: 10, y: 9, name: "Bé Na", look: 1, lines: ["Water feeds Wood, Wood feeds Fire, Fire feeds Earth, Earth feeds Metal, Metal feeds Water!", "And each one tames the one two steps on. Water tames Fire. Grandma taught me."] },
    ],
    enter: [2, 6],
  },
  {
    id: "bamboo",
    name: "Rừng Tre",
    en: "Bamboo Grove",
    theme: { ground: 0xb9d98a, grass: 0x5fae3e, tree: 0x2f7a3a, water: 0x5bb8e8, accent: 0x7fbf4d },
    rows: fit([
      "####################",
      "#,,,,##,,,,,,##,,,,#",
      "#,,,,##,,,,,,##,,,,#",
      "#....##..,,..##....#",
      "#.....V............#",
      "<========S=======K.G",
      "<..................G",
      "#,,,..##..,,,..##..#",
      "#,,,,.##.,,,,,.##..#",
      "#,,,,.##.,,,,,.##.V#",
      "#f....##.......##.f#",
      "####################",
    ]),
    wild: [
      { species: "mamTre", weight: 4 },
      { species: "namLun", weight: 3 },
      { species: "beo", weight: 2 },
      { species: "giot", weight: 1 },
    ],
    levels: [4, 7],
    keeper: {
      name: "Anh Lâm",
      title: "Keeper of the Grove Shrine",
      team: [["namLun", 7], ["beo", 8], ["mamTre", 9]],
      before: "Bamboo bends, it doesn't break. Let's see if your team does the same.",
      after: "The kitchen hill is past the gate. Bring something that tames Fire!",
    },
    villagers: [
      { x: 6, y: 4, name: "Ông Ba", look: 2, lines: ["A sleepy mushroom can put others to sleep too. A sleeping sproutling is easier to befriend.", "Low on health, but not knocked out? That's when they trust you most."] },
      { x: 18, y: 9, name: "Chị Hạnh", look: 3, lines: ["Your sproutlings resting on the bench help the one fighting, if their element feeds it.", "A Water friend on the bench keeps a Wood friend going. Order your team well!"] },
    ],
    enter: [1, 6],
  },
  {
    id: "kitchen",
    name: "Đồi Bếp",
    en: "Kitchen Hill",
    theme: { ground: 0xe8cf9a, grass: 0xc9a85c, tree: 0x8a5a2b, water: 0x5bb8e8, accent: 0xf2b230 },
    rows: fit([
      "####################",
      "#..,,,,..##..,,,,..#",
      "#..,,,,,.##.,,,,,..#",
      "#...,,,..##..,,,...#",
      "#.....V............#",
      "<=========S======K.G",
      "<..................G",
      "#.,,,,.........,,,.#",
      "#.,,,,,..###..,,,,.#",
      "#..,,,...###V.,,,..#",
      "#f.......###.....f.#",
      "####################",
    ]),
    wild: [
      { species: "thanHong", weight: 4 },
      { species: "denTroi", weight: 3 },
      { species: "namLun", weight: 1 },
      { species: "datSet", weight: 2 },
    ],
    levels: [6, 9],
    keeper: {
      name: "Bà Tám",
      title: "Keeper of the Hearth Shrine",
      team: [["denTroi", 10], ["datSet", 10], ["thanHong", 11]],
      before: "My stove has been warm for sixty years. Let's see if your sproutlings can stand the heat!",
      after: "Good! Down the hill is the clay bank. Mind the mud.",
    },
    villagers: [
      { x: 6, y: 4, name: "Chú Sáu", look: 0, lines: ["At level 12 some sproutlings can grow into a bigger form.", "But only at a shrine, and only when you choose. Open your team at the shrine."] },
      { x: 12, y: 9, name: "Bé Bin", look: 1, lines: ["The ember kitten loves warmth, but not too much. Hold it just right!"] },
    ],
    enter: [1, 6],
  },
  {
    id: "clay",
    name: "Bãi Đất Sét",
    en: "Clay Riverbank",
    theme: { ground: 0xd9b48a, grass: 0x9fae5c, tree: 0x6b4a2b, water: 0x6aa8c8, accent: 0xb06a3a },
    rows: fit([
      "####################",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~,,,,~~~~,,,,~~~#",
      "#...,,,,....,,,,...#",
      "#....V.............#",
      "<========S=======K.G",
      "<..................G",
      "#..,,,,,....,,,,,..#",
      "#..,,,,,....,,,,,.V#",
      "#~~..,,..~~..,,..~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "####################",
    ]),
    wild: [
      { species: "gom", weight: 4 },
      { species: "datSet", weight: 3 },
      { species: "cheo", weight: 2 },
      { species: "xu", weight: 1 },
    ],
    levels: [9, 12],
    keeper: {
      name: "Anh Thổ",
      title: "Keeper of the Kiln Shrine",
      team: [["datSet", 13], ["gom", 13], ["loGom", 14]],
      before: "A pot is shaped slowly, then fired hot. I hope your team is ready for the fire!",
      after: "The bell temple is on the next hill. Listen: you can hear it from here.",
    },
    villagers: [
      { x: 5, y: 4, name: "Cô Út", look: 3, lines: ["Earth tames Water. Earth feeds Metal. Clay pots ring like little bells when they're fired!"] },
      { x: 18, y: 8, name: "Ông Năm", look: 2, lines: ["Guarding halves the damage you take for one turn. Good while a friend on the bench feeds you."] },
    ],
    enter: [1, 6],
  },
  {
    id: "temple",
    name: "Chùa Chuông",
    en: "Bell Temple",
    theme: { ground: 0xd8d4c8, grass: 0x8fbf6a, tree: 0x4a6a4a, water: 0x5bb8e8, accent: 0xc9a227 },
    rows: fit([
      "####################",
      "#..,,,,,......,,,,.#",
      "#..,,,,,..##..,,,,.#",
      "#.........##.......#",
      "#..V...............#",
      "<=========S======K.G",
      "<..................G",
      "#.,,,,..f....f..,,.#",
      "#.,,,,,........,,,.#",
      "#..,,,....V...,,,,.#",
      "#f.......##.......f#",
      "####################",
    ]),
    wild: [
      { species: "chuongNho", weight: 4 },
      { species: "xu", weight: 3 },
      { species: "kimChi", weight: 3 },
      { species: "denTroi", weight: 1 },
    ],
    levels: [12, 15],
    keeper: {
      name: "Sư Cô Tịnh",
      title: "Keeper of the Bell Shrine",
      team: [["kimChi", 16], ["xu", 16], ["daiChuong", 17]],
      before: "One clear bell is worth a hundred noisy ones. Show me a team in harmony.",
      after: "Only the windy peak is left. Its keeper has every element. Go gently.",
    },
    villagers: [
      { x: 3, y: 4, name: "Chú Tiểu", look: 1, lines: ["The bell beetle rings in rhythm. Tap with it, not against it, and it will follow you."] },
      { x: 10, y: 9, name: "Bà Hai", look: 2, lines: ["Fire tames Metal. Metal tames Wood. Remember who tames whom!"] },
    ],
    enter: [1, 6],
  },
  {
    id: "peak",
    name: "Đỉnh Gió",
    en: "Windy Peak",
    theme: { ground: 0xc8d8c0, grass: 0x8ab87a, tree: 0x5a7a6a, water: 0x8fc8e8, accent: 0x8a5ce6 },
    rows: fit([
      "####################",
      "###,,,,,,....,,,,###",
      "##.,,,,,,....,,,,.##",
      "#....###....###....#",
      "#.V................#",
      "<=========S=====K..#",
      "<..................#",
      "#..,,,,,....,,,,...#",
      "#..,,,,,....,,,,,..#",
      "##..,,,......,,,..##",
      "###f............f###",
      "####################",
    ]),
    wild: [
      { species: "kimChi", weight: 2 },
      { species: "denTroi", weight: 2 },
      { species: "datSet", weight: 2 },
      { species: "cheo", weight: 2 },
      { species: "namLun", weight: 2 },
    ],
    levels: [15, 18],
    keeper: {
      name: "Ông Gió",
      title: "Keeper of the Peak",
      team: [["songGiot", 19], ["bepLua", 19], ["luyTre", 20]],
      before: "Every shrine on Clearwater Isle is awake, thanks to you. One last calm, friendly battle?",
      after: "The whole island sings again. Thank you, little gardener. Come back any time: new sproutlings will wake up soon.",
    },
    villagers: [{ x: 2, y: 4, name: "Bé Mây", look: 3, lines: ["Grandpa Gió has a sproutling of almost every element. Bring a mix!"] }],
    enter: [1, 6],
  },
];

export const STARTERS: SpeciesId[] = ["giot", "mamTre", "thanHong"];
export const tileAt = (area: Area, x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? "#" : area.rows[y][x]);
export function findTile(area: Area, ch: string): [number, number] | null {
  for (let y = 0; y < MAP_H; y++) {
    const x = area.rows[y].indexOf(ch);
    if (x >= 0) return [x, y];
  }
  return null;
}
/** Can you stand here? (gates open once that area's keeper is beaten) */
export function walkable(area: Area, x: number, y: number, gateOpen: boolean) {
  const t = tileAt(area, x, y);
  if (t === "G") return gateOpen;
  return !SOLID.has(t);
}
/** Shortest walk (4 directions) to the target tile, or to a tile next to it when the target is solid */
export function pathTo(area: Area, from: [number, number], to: [number, number], gateOpen: boolean): [number, number][] | null {
  const goal = (x: number, y: number) => (x === to[0] && y === to[1]) || (!walkable(area, to[0], to[1], gateOpen) && Math.abs(x - to[0]) + Math.abs(y - to[1]) === 1);
  const key = (x: number, y: number) => y * MAP_W + x;
  const prev = new Map<number, number>([[key(...from), -1]]);
  const queue: [number, number][] = [from];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (goal(x, y)) {
      const out: [number, number][] = [];
      let k = key(x, y);
      while (k !== key(...from)) {
        out.unshift([k % MAP_W, Math.floor(k / MAP_W)]);
        k = prev.get(k)!;
      }
      return out;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (prev.has(key(nx, ny)) || !walkable(area, nx, ny, gateOpen)) continue;
      // the edges (< and an open G) take you to another area: only walk onto them on purpose
      const edge = tileAt(area, nx, ny) === "<" || tileAt(area, nx, ny) === "G";
      if (edge && !(nx === to[0] && ny === to[1])) continue;
      prev.set(key(nx, ny), key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}
