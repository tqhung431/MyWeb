import { tx } from "@/lib/i18n/core";
// Stage 15: the colour themes ("palettes"). The colours themselves are in app/palettes.css;
// this list gives each one a name for the theme picker. Every palette has a light and a dark version.

export const PALETTES = [
  { id: "nook", name: tx("Nook"), feel: tx("Calm indigo, the original") },
  { id: "bamboo", name: tx("Bamboo"), feel: tx("Fresh green, quiet") },
  { id: "ink", name: tx("Ink & Paper"), feel: tx("Ink-wash painting, red seal") },
  { id: "sunset", name: tx("Sunset"), feel: tx("Warm orange and rose") },
  { id: "ocean", name: tx("Ocean"), feel: tx("Cool teal and blue") },
  { id: "lotus", name: tx("Lotus"), feel: tx("Soft pink and lavender") },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((p) => p.id);

export function isPalette(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}
