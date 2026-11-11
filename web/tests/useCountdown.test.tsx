import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "@/features/focus/useCountdown";

beforeEach(() => vi.useFakeTimers()); // fake clock: we move time forward ourselves
afterEach(() => vi.useRealTimers());

describe("useCountdown", () => {
  it("counts down while running and stops when paused", () => {
    const { result } = renderHook(() => useCountdown(10_000, () => {}));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3_000));
    expect(result.current.remaining).toBe(7_000);

    act(() => result.current.pause());
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.remaining).toBe(7_000);
    expect(result.current.running).toBe(false);
  });

  it("calls onDone once at zero", () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useCountdown(2_000, onDone));
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.remaining).toBe(0);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("set() changes the length and stops the timer", () => {
    const { result } = renderHook(() => useCountdown(10_000, () => {}));
    act(() => result.current.start());
    act(() => result.current.set(5_000));
    expect(result.current).toMatchObject({ total: 5_000, remaining: 5_000, running: false, progress: 0 });
  });
});
