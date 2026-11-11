import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRACK_NAMES } from "@/features/ambient/engine";
import { TRACKS } from "@/features/ambient/tracks";
import { getThemePref, setThemePref, themeScript } from "@/features/theme/theme";

describe("sound library", () => {
  it("has a card for every generated sound, and a sound for every card", () => {
    expect(TRACKS.map((t) => t.name).sort()).toEqual([...TRACK_NAMES].sort());
  });

  it("has 10 Vietnamese drill songs that play one at a time", () => {
    const drill = TRACKS.filter((t) => t.category === "drill");
    expect(drill).toHaveLength(10);
    expect(drill.every((t) => t.exclusive)).toBe(true);
    expect(new Set(drill.map((t) => t.label)).size).toBe(10);
  });

  it("offers both music and nature sounds", () => {
    expect(TRACKS.filter((t) => t.category === "music").length).toBeGreaterThanOrEqual(5);
    expect(TRACKS.filter((t) => t.category === "nature").length).toBeGreaterThanOrEqual(5);
  });
});

describe("theme", () => {
  let deviceDark = false;
  beforeEach(() => {
    // jsdom has no matchMedia: pretend the device is in light or dark mode
    vi.stubGlobal("matchMedia", () => ({ matches: deviceDark, addEventListener() {}, removeEventListener() {} }));
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.themePref;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("the early script follows the device on 'System'", () => {
    deviceDark = true;
    new Function(themeScript)();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.themePref).toBe("system");
  });

  it("a saved choice wins over the device, and is remembered", () => {
    deviceDark = true;
    setThemePref("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");

    delete document.documentElement.dataset.theme;
    new Function(themeScript)(); // next visit
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(getThemePref()).toBe("light");
  });
});
