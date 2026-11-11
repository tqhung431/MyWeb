// Stage 10: the music queue rules (repeat, shuffle, removing songs).
import { describe, expect, it } from "vitest";
import { formatTime, nextIndex, nextRepeat, previousIndex, removeAt, shuffled } from "@/features/music/queue";

describe("next / previous", () => {
  it("stops after the last song when repeat is off", () => {
    expect(nextIndex(3, 1, "off", true)).toBe(2);
    expect(nextIndex(3, 2, "off", true)).toBeNull();
    expect(previousIndex(3, 0, "off")).toBeNull();
  });

  it("goes back to the start when repeating the queue", () => {
    expect(nextIndex(3, 2, "all", true)).toBe(0);
    expect(previousIndex(3, 0, "all")).toBe(2);
  });

  it("repeats one song only when it ends by itself; Next still moves on", () => {
    expect(nextIndex(3, 1, "one", true)).toBe(1);
    expect(nextIndex(3, 1, "one", false)).toBe(2);
    expect(nextIndex(3, 2, "one", false)).toBe(0);
  });

  it("cycles repeat off → all → one → off", () => {
    expect(nextRepeat("off")).toBe("all");
    expect(nextRepeat("all")).toBe("one");
    expect(nextRepeat("one")).toBe("off");
  });
});

describe("shuffle", () => {
  it("keeps the playing song first and every song once", () => {
    const list = ["a", "b", "c", "d", "e"];
    const out = shuffled(list, 2, () => 0.3);
    expect(out[0]).toBe("c");
    expect([...out].sort()).toEqual(list);
  });
});

describe("removing from the queue", () => {
  const list = ["a", "b", "c", "d"];
  it("keeps the playing song when removing another one", () => {
    expect(removeAt(list, 2, 0)).toEqual({ list: ["b", "c", "d"], index: 1 });
    expect(removeAt(list, 2, 3)).toEqual({ list: ["a", "b", "c"], index: 2 });
  });
  it("plays the next song when removing the playing one", () => {
    expect(removeAt(list, 1, 1)).toEqual({ list: ["a", "c", "d"], index: 1 });
    expect(removeAt(list, 3, 3)).toEqual({ list: ["a", "b", "c"], index: 2 });
    expect(removeAt(["a"], 0, 0)).toEqual({ list: [], index: null });
  });
});

it("formats times as m:ss", () => {
  expect(formatTime(0)).toBe("0:00");
  expect(formatTime(125.7)).toBe("2:05");
});
