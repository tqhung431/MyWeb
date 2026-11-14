// The Free-time Companion (Stage 9): status, and a streamed chat.

import { ApiError, apiFetch } from "./client";
import { clientId } from "./clientId";

export type CompanionStatus = {
  enabled: boolean;
  reachable: boolean;
  ready: boolean;
  models: { chat: boolean; embed: boolean };
  chatModel: string;
  embedModel: string;
  indexed: number;
};

export type Source =
  | { kind: "song"; id: number; title: string; artist: string; genre: "drill" | "remix" | "pop" | "lofi"; audioUrl: string; artworkUrl: string | null }
  | { kind: "tip"; slug: string; title: string; summary: string }
  | { kind: "guide"; id: string; title: string; href: string }; // Stage 31: an app the answer talked about

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function getCompanionStatus(timeoutMs?: number): Promise<CompanionStatus> {
  return apiFetch<CompanionStatus>("/api/companion/status", { timeoutMs });
}

type Handlers = { onSources: (s: Source[]) => void; onToken: (t: string) => void };

// POST the conversation, then read the answer as it streams in.
// (The browser's EventSource only does GET, so we read the Server-Sent Events by hand.)
export async function streamChat(messages: ChatTurn[], handlers: Handlers, signal: AbortSignal): Promise<void> {
  const res = await fetch("/api/companion/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-Id": clientId() },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? `The Companion answered ${res.status}`, body.details);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    // Events are separated by a blank line: "event: token\ndata: {...}\n\n"
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "null");
      if (event === "sources") handlers.onSources(data);
      else if (event === "token") handlers.onToken(data.t);
      else if (event === "error") throw new ApiError(503, data.message);
      else if (event === "done") return;
    }
  }
}
