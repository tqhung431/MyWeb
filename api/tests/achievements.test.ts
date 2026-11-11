// The badge rules, as plain functions: no database, no Valkey.

import { describe, expect, it } from "vitest";
import { earnedCodes } from "../src/achievements.js";

// A focus session at a given local time in Ho Chi Minh City (UTC+7).
const at = (isoLocal: string, minutes = 25) => ({ minutes, completedAt: new Date(`${isoLocal}+07:00`) });
const TZ = "Asia/Ho_Chi_Minh";

describe("achievement rules", () => {
  it("gives nothing for no sessions", () => {
    expect(earnedCodes([], TZ)).toEqual([]);
  });

  it("counts the first session", () => {
    expect(earnedCodes([at("2026-11-11T14:00:00")], TZ)).toEqual(["first-focus"]);
  });

  it("finds 4 sessions in one day and 100 minutes in total", () => {
    const day = ["09:00", "10:00", "11:00", "12:00"].map((t) => at(`2026-11-11T${t}:00`));
    expect(earnedCodes(day, TZ)).toEqual(expect.arrayContaining(["four-in-a-day", "hundred-minutes"]));
  });

  it("finds a 3-day streak, but not with a gap", () => {
    const streak = [at("2026-11-09T15:00:00"), at("2026-11-10T15:00:00"), at("2026-11-11T15:00:00")];
    const gap = [at("2026-11-07T15:00:00"), at("2026-11-10T15:00:00"), at("2026-11-11T15:00:00")];
    expect(earnedCodes(streak, TZ)).toContain("streak-3");
    expect(earnedCodes(gap, TZ)).not.toContain("streak-3");
  });

  it("uses the person's own time zone for early bird and night owl", () => {
    // 23:30 in Ho Chi Minh City is 16:30 UTC: a night owl there, not in UTC
    const late = [at("2026-11-11T23:30:00")];
    expect(earnedCodes(late, TZ)).toContain("night-owl");
    expect(earnedCodes(late, "UTC")).not.toContain("night-owl");
    expect(earnedCodes([at("2026-11-11T06:15:00")], TZ)).toContain("early-bird");
  });
});
