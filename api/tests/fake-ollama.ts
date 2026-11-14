// A tiny fake of Ollama's API, so tests don't need real AI models.
//
// Embeddings: "bag of words": each word adds 1 to one of 768 slots (picked by a hash), then the
// vector is scaled to length 1. Texts that share words point the same way: close in "meaning".
// Chat: streams an answer that names the first Nook item it was given, a few letters at a time.

import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";

export function fakeEmbedding(text: string): number[] {
  const v = new Array(768).fill(0);
  for (const word of text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []) {
    v[createHash("md5").update(word).digest().readUInt16BE(0) % 768] += 1;
  }
  const len = Math.hypot(...v) || 1;
  return v.map((x) => x / len);
}

export function startFakeOllama(port = 4997, models = ["qwen2.5:1.5b", "paraphrase-multilingual:latest"]): Promise<Server> {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const data = body ? JSON.parse(body) : {};
      if (req.url === "/api/tags") return res.end(JSON.stringify({ models: models.map((name) => ({ name })) }));
      if (req.url === "/api/embed") {
        if (!models.some((m) => m.startsWith(data.model))) return void res.writeHead(404).end();
        return res.end(JSON.stringify({ embeddings: (data.input as string[]).map(fakeEmbedding) }));
      }
      if (req.url === "/api/chat") {
        const system: string = data.messages[0].content;
        // Stage 31: guide entries too ("Nook guide — Settings (/settings): …")
        const first = system.match(/\[1\] (?:Song with vocals: "([^"]+)"|Focus tip: ([^.]+)|Nook guide — ([^(]+) \()/);
        const answer = !first
          ? "I couldn't find anything in Nook for that."
          : first[3]
            ? `Open ${first[3]} in Nook: it's all there.`
            : `You could try “${first[1] ?? first[2]}”. Enjoy!`;
        res.writeHead(200, { "Content-Type": "application/x-ndjson" });
        for (let i = 0; i < answer.length; i += 6) {
          res.write(JSON.stringify({ message: { role: "assistant", content: answer.slice(i, i + 6) }, done: false }) + "\n");
          await new Promise((r) => setTimeout(r, 5));
        }
        return res.end(JSON.stringify({ message: { role: "assistant", content: "" }, done: true }) + "\n");
      }
      res.writeHead(404).end();
    });
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
