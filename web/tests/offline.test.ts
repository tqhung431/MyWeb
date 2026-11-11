// Stage 13: changes made offline wait on the device and are sent later (lib/offline.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, sendOrKeep, waitingCount } from "@/lib/offline";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("offline queue", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a request when the network is down, and sends it later", async () => {
    // Nothing waiting: the first flush finishes at once and must not stay "busy"
    expect(await flush()).toBe(0);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await sendOrKeep("habit:1:2026-11-11", "/api/habits/1/days/2026-11-11", { method: "PUT", body: { done: true } })).toEqual({ sent: false });
    expect(waitingCount()).toBe(1);
    expect(await flush()).toBe(0); // still offline: kept
    expect(waitingCount()).toBe(1);

    const fetch = vi.fn().mockResolvedValue(ok({ done: true }));
    vi.stubGlobal("fetch", fetch);
    expect(await flush()).toBe(1);
    expect(waitingCount()).toBe(0);
    expect(fetch).toHaveBeenCalledWith("/api/habits/1/days/2026-11-11", expect.objectContaining({ method: "PUT", body: '{"done":true}' }));
  });

  it("keeps only the latest change for the same thing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await sendOrKeep("habit:1:d", "/x", { method: "PUT", body: { done: true } });
    await sendOrKeep("habit:1:d", "/x", { method: "PUT", body: { done: false } });
    expect(waitingCount()).toBe(1);
    expect(JSON.parse(localStorage.getItem("nook.offline")!)[0].body).toBe('{"done":false}');
  });

  it("drops a request the API refuses, instead of trying forever", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await sendOrKeep("habit:9:d", "/api/habits/9/days/d", { method: "PUT", body: { done: true } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Habit not found" }), { status: 404 })));
    await flush();
    expect(waitingCount()).toBe(0);
  });

  it("doesn't keep requests the API answered with an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 400 })));
    await expect(sendOrKeep("k", "/x", { method: "PUT", body: {} })).rejects.toThrow("nope");
    expect(waitingCount()).toBe(0);
  });
});
