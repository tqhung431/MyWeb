// Stage 15: the colour themes ("palettes"). The colours themselves are in app/palettes.css;
// this list gives each one a name for the theme picker. Every palette has a light and a dark version.

export const PALETTES = [
  { id: "nook", name: "Nook", feel: "Calm indigo, the original" },
  { id: "bamboo", name: "Bamboo", feel: "Fresh green, quiet" },
  { id: "ink", name: "Ink & Paper", feel: "Ink-wash painting, red seal" },
  { id: "sunset", name: "Sunset", feel: "Warm orange and rose" },
  { id: "ocean", name: "Ocean", feel: "Cool teal and blue" },
  { id: "lotus", name: "Lotus", feel: "Soft pink and lavender" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export const PALETTE_IDS: readonly PaletteId[] = PALETTES.map((p) => p.id);

export function isPalette(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}
