// The theme has two parts:
//   mode     System (follow the device), Light or Dark
//   palette  the colour theme: Nook, Bamboo, Ink & Paper, ... (Stage 15, see palettes.ts)
//
// Where it lives:
//   localStorage "theme", "palette"   your choices, kept between visits
//   <html data-theme-pref="…">        your mode choice, for this page
//   <html data-theme="dark">          what's actually shown; the CSS reads this
//   <html data-palette="bamboo">      the colour theme; the CSS in app/palettes.css reads this
//
// Note: the "N" button in development is Next.js's own developer panel. Its Theme option
// only changes that panel, never the app. This file is the app's theme.

import { isPalette, PALETTE_IDS, type PaletteId } from "./palettes";

export type ThemePref = "system" | "light" | "dark";

const KEY = "theme";
const PALETTE_KEY = "palette";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

// Runs in <head> before anything is drawn, so a dark page never flashes white.
// Kept tiny and dependency-free on purpose: it's inlined as text.
export const themeScript = `(function(){try{var e=document.documentElement;var c=localStorage.getItem("${PALETTE_KEY}");e.dataset.palette=${JSON.stringify(PALETTE_IDS)}.indexOf(c)>=0?c:"nook";var p=localStorage.getItem("${KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);e.dataset.theme=d?"dark":"light";e.dataset.themePref=p;}catch(_){}})();`;

const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  const p = document.documentElement.dataset.themePref;
  return p === "light" || p === "dark" ? p : "system";
}

export function getPalette(): PaletteId {
  const p = document.documentElement.dataset.palette;
  return isPalette(p) ? p : "nook";
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePref = pref;
  listeners.forEach((l) => l());
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
}

export function setThemePref(pref: ThemePref) {
  save(KEY, pref);
  apply(pref);
}

export function setPalette(palette: PaletteId) {
  save(PALETTE_KEY, palette);
  document.documentElement.dataset.palette = palette;
  listeners.forEach((l) => l());
}

// For useSyncExternalStore: React re-renders when the theme changes,
// including when the device switches between light and dark while on "System".
export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const onDeviceChange = () => {
    if (getThemePref() === "system") apply("system");
  };
  const mq = media();
  mq.addEventListener("change", onDeviceChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener("change", onDeviceChange);
  };
}
