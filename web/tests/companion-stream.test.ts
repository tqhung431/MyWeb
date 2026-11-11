// The Companion's answer arrives as Server-Sent Events, in network chunks that can cut an event in half.
import { afterEach, describe, expect, it, vi } from "vitest";
import { streamChat } from "@/lib/api/companion";

function respond(chunks: string[], status = 200) {
  const body = new ReadableStream({
    start(c) {
      chunks.forEach((s) => c.enqueue(new TextEncoder().encode(s)));
      c.close();
    },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("streamChat", () => {
  it("reads sources and tokens, even when events are split between chunks", async () => {
    const sse =
      'event: sources\ndata: [{"kind":"tip","slug":"real-breaks","title":"Real breaks","summary":"s"}]\n\n' +
      'event: token\ndata: {"t":"Xin "}\n\nevent: token\ndata: {"t":"chào"}\n\nevent: done\ndata: {}\n\n';
    respond([sse.slice(0, 30), sse.slice(30, 95), sse.slice(95)]);
    const sources = vi.fn();
    let text = "";
    await streamChat([{ role: "user", content: "hi" }], { onSources: sources, onToken: (t) => (text += t) }, new AbortController().signal);
    expect(sources).toHaveBeenCalledWith([expect.objectContaining({ slug: "real-breaks" })]);
    expect(text).toBe("Xin chào");
  });

  it("turns an error event or a failed request into an error", async () => {
    respond(['event: error\ndata: {"message":"Ollama stopped"}\n\n']);
    await expect(streamChat([], { onSources() {}, onToken() {} }, new AbortController().signal)).rejects.toThrow("Ollama stopped");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "The Companion is turned off" }, { status: 503 })));
    await expect(streamChat([], { onSources() {}, onToken() {} }, new AbortController().signal)).rejects.toThrow("turned off");
  });
});
