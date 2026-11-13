// Stage 23 · Ngõ Pháo: names shown in menus (translated where shown with t()).
import { tx } from "@/lib/i18n/core";

export const MAP_NAMES: Record<string, string> = { random: tx("Random"), "old-town": tx("Old Town"), market: tx("Market"), rooftops: tx("Rooftops") };
export const HAT_LABELS = [tx("No hat"), tx("Leaf hat"), tx("Cat ears"), tx("Ribbon"), tx("Dragon horns")];
export const COLOR_LABELS = [tx("Red"), tx("Jade"), tx("Gold"), tx("Violet")];
export const AWARD_NAMES: Record<string, string> = {
  "Most crates": tx("Most crates"),
  "Sharpest aim": tx("Sharpest aim"),
  Collector: tx("Collector"),
  "Tripped on own cracker": tx("Tripped on own cracker"),
  "Pesky ghost": tx("Pesky ghost"),
};
