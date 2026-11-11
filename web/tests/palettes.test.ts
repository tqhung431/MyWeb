// Stage 15: every colour theme, light and dark, must stay readable (WCAG contrast).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PALETTE_IDS } from "@/features/theme/palettes";
import { getPalette, setPalette, themeScript } from "@/features/theme/theme";

const css = readFileSync(join(__dirname, "../app/palettes.css"), "utf8");

// Every rule in palettes.css: which palette, light or dark, and its tokens
function blocks() {
  const out: { palette: string; dark: boolean; vars: Record<string, string> }[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
    const palette = selector.match(/\[data-palette="(\w+)"\]/)?.[1];
    if (!palette) continue;
    const vars = Object.fromEntries([...m[2].matchAll(/--([\w-]+):\s*([^;]+);/g)].map((v) => [v[1], v[2].trim()]));
    out.push({ palette, dark: selector.includes('data-theme="dark"'), vars });
  }
  return out;
}

// WCAG 2 contrast ratio between two #rrggbb colours
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const all = blocks();

it("has a light and a dark version of every palette in the picker, and nothing else", () => {
  expect([...new Set(all.map((b) => b.palette))].sort()).toEqual([...PALETTE_IDS].sort());
  for (const id of PALETTE_IDS) {
    expect(all.filter((b) => b.palette === id).map((b) => b.dark)).toEqual([false, true]);
  }
});

it("sets the same tokens in every block", () => {
  const names = Object.keys(all[0].vars).sort();
  for (const b of all) expect(Object.keys(b.vars).sort(), `${b.palette} ${b.dark ? "dark" : "light"}`).toEqual(names);
});

describe.each(all.map((b) => [`${b.palette} ${b.dark ? "dark" : "light"}`, b.vars] as const))("%s", (_, v) => {
  it("text and muted text are readable on the page and on cards (4.5:1)", () => {
    for (const bg of [v.background, v["surface-strong"]]) {
      expect(contrast(v.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(v.muted, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("button text is readable on the primary colours", () => {
    expect(contrast(v["on-primary"], v.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(v["on-primary"], v["primary-2"])).toBeGreaterThanOrEqual(3); // the end of the gradient, bold text
  });
  it("the primary colour stands out from the page (3:1, for icons and links)", () => {
    expect(contrast(v.primary, v.background)).toBeGreaterThanOrEqual(3);
  });
});

describe("choosing a palette", () => {
  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.palette;
  });

  it("is saved and comes back on the next visit", () => {
    setPalette("ink");
    expect(document.documentElement.dataset.palette).toBe("ink");
    delete document.documentElement.dataset.palette;
    new Function(themeScript)();
    expect(getPalette()).toBe("ink");
  });

  it("falls back to Nook for unknown or old values", () => {
    localStorage.setItem("palette", "neon");
    new Function(themeScript)();
    expect(document.documentElement.dataset.palette).toBe("nook");
  });
});
