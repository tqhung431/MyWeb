// The theme: System (follow the device), Light or Dark.
//
// Where it lives:
//   localStorage "theme"         your choice, kept between visits
//   <html data-theme-pref="…">   your choice, for this page
//   <html data-theme="dark">     what's actually shown; the CSS in globals.css reads this
//
// Note: the "N" button in development is Next.js's own developer panel. Its Theme option
// only changes that panel, never the app. This file is the app's theme.

export type ThemePref = "system" | "light" | "dark";

const KEY = "theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

// Runs in <head> before anything is drawn, so a dark page never flashes white.
// Kept tiny and dependency-free on purpose: it's inlined as text.
export const themeScript = `(function(){try{var p=localStorage.getItem("${KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var e=document.documentElement;e.dataset.theme=d?"dark":"light";e.dataset.themePref=p;}catch(_){}})();`;

const listeners = new Set<() => void>();

export function getThemePref(): ThemePref {
  const p = document.documentElement.dataset.themePref;
  return p === "light" || p === "dark" ? p : "system";
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && media().matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.themePref = pref;
  listeners.forEach((l) => l());
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  apply(pref);
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
