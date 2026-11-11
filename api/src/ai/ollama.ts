// Talking to Ollama: a program that runs open AI models on your own computer.
// Nothing leaves your network. Its HTTP API (https://github.com/ollama/ollama/blob/main/docs/api.md):
//
//   GET  /api/tags    which models are downloaded
//   POST /api/embed   text → embedding (a list of numbers that captures the meaning)
//   POST /api/chat    messages → an answer, streamed piece by piece (one JSON object per line)

import { config } from "../config.js";

export const aiEnabled = () => Boolean(config.OLLAMA_URL);

export class AiUnavailable extends Error {}

async function call(path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
  if (!config.OLLAMA_URL) throw new AiUnavailable("AI is switched off (OLLAMA_URL is not set)");
  let res: Response;
  try {
    res = await fetch(`${config.OLLAMA_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ?? AbortSignal.timeout(body ? 120_000 : 3000),
    });
  } catch (error) {
    if ((error as Error).name === "AbortError" && signal?.aborted) throw error;
    throw new AiUnavailable("Can't reach Ollama. Is it running?");
  }
  if (res.status === 404) throw new AiUnavailable("The AI model isn't downloaded yet (see docs/stage-9.md)");
  if (!res.ok) throw new AiUnavailable(`Ollama answered ${res.status}`);
  return res;
}

// Which of the two models are ready?
export async function aiStatus(): Promise<{ enabled: boolean; reachable: boolean; models: { chat: boolean; embed: boolean } }> {
  const none = { chat: false, embed: false };
  if (!aiEnabled()) return { enabled: false, reachable: false, models: none };
  try {
    const { models } = (await (await call("/api/tags")).json()) as { models: { name: string }[] };
    const has = (m: string) => models.some((x) => x.name === m || x.name === `${m}:latest`);
    return { enabled: true, reachable: true, models: { chat: has(config.AI_CHAT_MODEL), embed: has(config.AI_EMBED_MODEL) } };
  } catch {
    return { enabled: true, reachable: false, models: none };
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const res = await call("/api/embed", { model: config.AI_EMBED_MODEL, input: texts });
  const { embeddings } = (await res.json()) as { embeddings: number[][] };
  return embeddings;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Yields the answer as it's written. Stopping (signal) also stops Ollama working on it.
export async function* chatStream(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<string> {
  const res = await call(
    "/api/chat",
    { model: config.AI_CHAT_MODEL, messages, stream: true, options: { temperature: 0.6, num_ctx: 4096 } },
    signal,
  );
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // One JSON object per line: {"message":{"content":"Hel"},"done":false}
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const part = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
      if (part.error) throw new AiUnavailable(part.error);
      if (part.message?.content) yield part.message.content;
      if (part.done) return;
    }
  }
}
