// Stage 26 · Mầm Thú: words shown on screen (translated with t()); the sproutlings keep their Vietnamese names.
import { tx } from "@/lib/i18n/core";
import type { Element, MoveId, SpeciesId } from "./sprout";

export const ELEMENT_INFO: Record<Element, { name: string; vi: string; emoji: string; color: string; chip: string }> = {
  water: { name: tx("Water"), vi: "Thủy", emoji: "💧", color: "#4aa8e0", chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  wood: { name: tx("Wood"), vi: "Mộc", emoji: "🌿", color: "#5fae3e", chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  fire: { name: tx("Fire"), vi: "Hỏa", emoji: "🔥", color: "#ff6a3a", chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
  earth: { name: tx("Earth"), vi: "Thổ", emoji: "🪨", color: "#b0702e", chip: "bg-amber-700/15 text-amber-800 dark:text-amber-300" },
  metal: { name: tx("Metal"), vi: "Kim", emoji: "🔔", color: "#c9a227", chip: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300" },
};

export const SPECIES_INFO: Record<SpeciesId, string> = {
  giot: tx("A raindrop tadpole born in a puddle after rain."),
  songGiot: tx("A grown Giọt: a little wave that never stops dancing."),
  cheo: tx("A duckling who rows a lotus-leaf boat across the pond."),
  beo: tx("A slow, kind turtle with a shell of floating duckweed."),
  mamTre: tx("A bamboo-shoot hedgehog. Its spikes are soft, until they aren't."),
  luyTre: tx("A grown Mầm Tre: as sturdy as a village's bamboo hedge."),
  namLun: tx("A sleepy mushroom. Its yawns put others to sleep too."),
  thanHong: tx("An ember kitten from an old kitchen stove. Loves warmth, not too much."),
  bepLua: tx("A grown Than Hồng: a proud hearth cat with a flame mane."),
  denTroi: tx("A sky-lantern moth. It glows brighter when it's happy."),
  gom: tx("A clay-pot armadillo that rolls up when shy."),
  loGom: tx("A grown Gốm: a little kiln with a warm heart and a smoking chimney."),
  datSet: tx("A mud-pie frog from the riverbank. Very proud of its mud pies."),
  chuongNho: tx("A little bell beetle. It rings in rhythm with your steps."),
  daiChuong: tx("A grown Chuông Nhỏ: its toll can be heard across the island."),
  xu: tx("A crab that lives in an old coin with a square hole."),
  kimChi: tx("A needle dragonfly that trails a red thread wherever it flies."),
};

export const MOVE_NAMES: Record<MoveId, string> = {
  splash: tx("Splash"),
  ripple: tx("Ripple"),
  rainCurtain: tx("Rain Curtain"),
  tidalHug: tx("Tidal Hug"),
  leafPoke: tx("Leaf Poke"),
  bambooJab: tx("Bamboo Jab"),
  sporeNap: tx("Spore Nap"),
  grovesBlessing: tx("Grove's Blessing"),
  emberPounce: tx("Ember Pounce"),
  warmGlow: tx("Warm Glow"),
  lanternDrift: tx("Lantern Drift"),
  hearthBlaze: tx("Hearth Blaze"),
  mudToss: tx("Mud Toss"),
  clayShell: tx("Clay Shell"),
  potRoll: tx("Pot Roll"),
  kilnQuake: tx("Kiln Quake"),
  chime: tx("Chime"),
  coinFlick: tx("Coin Flick"),
  bellGuard: tx("Bell Guard"),
  grandToll: tx("Grand Toll"),
  nuzzle: tx("Nuzzle"),
  rest: tx("Rest"),
};
export const EFFECT_INFO: Record<string, string> = {
  heal: tx("heals itself"),
  guard: tx("takes much less damage this turn"),
  sleep: tx("puts the other to sleep"),
  boostAtk: tx("hits harder after this"),
  lowerDef: tx("softens the other's defence"),
  drain: tx("heals by half the damage"),
  slowFoe: tx("slows the other down"),
};
