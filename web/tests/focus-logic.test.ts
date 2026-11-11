import { describe, expect, it } from "vitest";
import { formatTime, streak } from "@/features/focus/logic";

const day = (sessions: number) => ({ date: "2026-11-11", sessions, minutes: sessions * 25 });

describe("formatTime", () => {
  it("shows minutes and seconds with two digits", () => {
    expect(formatTime(25 * 60 * 1000)).toBe("25:00");
    expect(formatTime(61_000)).toBe("01:01");
    expect(formatTime(0)).toBe("00:00");
  });

  it("rounds up partial seconds, so 00:00 only shows at the very end", () => {
    expect(formatTime(400)).toBe("00:01");
  });
});

describe("streak", () => {
  it("counts days in a row up to today", () => {
    expect(streak([day(0), day(1), day(2), day(1)])).toBe(3);
  });

  it("still counts yesterday's streak when today is empty so far", () => {
    expect(streak([day(1), day(1), day(0)])).toBe(2);
  });

  it("is zero with no sessions", () => {
    expect(streak([day(0), day(0)])).toBe(0);
  });
});
