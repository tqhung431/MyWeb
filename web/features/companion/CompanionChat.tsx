"use client";

// The Free-time Companion (Stage 9): chat with a local AI (Ollama) that knows Nook's songs and tips.
// The answer streams in word by word; the songs and tips it used appear as cards under it.

import { ArrowUp, Loader2, RotateCcw, Sparkles, Square } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCompanionStatus, streamChat, type ChatTurn, type CompanionStatus, type Source } from "@/lib/api/companion";
import { SourceCards } from "./SourceCard";
import { StatusCard } from "./StatusCard";

type Message = ChatTurn & { sources?: Source[]; error?: string };

const SUGGESTIONS = [
  "I need to focus for an hour. What should I play?",
  "Give me a tip for taking better breaks",
  "Gợi ý một bài remix sôi động cho buổi tối",
  "Mình hơi mệt, nên nghe gì để thư giãn?",
];

// Stage 19 (speed): the page asks the API on the server first (initialStatus), so the right card is in the
// first HTML; the browser only asks again if the server couldn't.
export function CompanionChat({ initialStatus = null }: { initialStatus?: CompanionStatus | null }) {
  const [status, setStatus] = useState<CompanionStatus | null | "error">(initialStatus);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const refresh = () => getCompanionStatus().then(setStatus, () => setStatus("error"));
  useEffect(() => {
    if (!initialStatus) void refresh();
    return () => abort.current?.abort();
  }, [initialStatus]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  // Change the last message (the answer being written)
  const patchLast = (fn: (m: Message) => Message) => setMessages((list) => [...list.slice(0, -1), fn(list[list.length - 1])]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const history: ChatTurn[] = [...messages, { role: "user" as const, content: question }]
      .filter((m) => m.content)
      .slice(-10)
      .map(({ role, content }) => ({ role, content }));
    setMessages((list) => [...list, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamChat(
        history,
        {
          onSources: (sources) => patchLast((m) => ({ ...m, sources })),
          onToken: (t) => patchLast((m) => ({ ...m, content: m.content + t })),
        },
        controller.signal,
      );
    } catch (e) {
      if (!controller.signal.aborted) patchLast((m) => ({ ...m, error: e instanceof Error ? e.message : "Something went wrong." }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  if (status === null) {
    return (
      <Card className="flex items-center gap-3 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Waking up the Companion…
      </Card>
    );
  }
  if (status === "error" || !status.ready) return <StatusCard status={status === "error" ? null : status} onRetry={refresh} />;

  return (
    <Card className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="py-6 text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-fuchsia-400 to-purple-600 text-white">
              <Sparkles className="h-7 w-7" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-lg font-bold">What do you feel like doing?</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              Ask in English or Vietnamese. I suggest songs and tips that are really in Nook, and I run on this computer, so your chat stays here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" onClick={() => void send(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="ml-auto w-fit max-w-[85%] rounded-3xl rounded-br-md bg-linear-to-r from-primary to-primary-2 px-4 py-2.5 text-on-primary">
                {m.content}
              </p>
            ) : (
              <div key={i} className="max-w-[90%]">
                <div className="w-fit rounded-3xl rounded-bl-md bg-surface-muted px-4 py-2.5 whitespace-pre-wrap">
                  {m.content || (m.error ? "" : <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Thinking" />)}
                  {m.error && <span className="text-rose-600 dark:text-rose-400">{m.error}</span>}
                </div>
                {m.sources && <SourceCards sources={m.sources} />}
              </div>
            ),
          )
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={submit} className="mt-5 flex items-end gap-2">
        {messages.length > 0 && !busy && (
          <Button variant="ghost" size="icon" onClick={() => setMessages([])} aria-label="New chat" title="New chat">
            <RotateCcw className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
        <label className="sr-only" htmlFor="companion-input">
          Message the Companion
        </label>
        <textarea
          id="companion-input"
          rows={1}
          value={input}
          maxLength={2000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask for a song or a tip…"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-surface-strong/70 px-4 py-2.5 focus:ring-2 focus:ring-primary focus:outline-none"
        />
        {busy ? (
          <Button variant="secondary" size="icon" onClick={() => abort.current?.abort()} aria-label="Stop">
            <Square className="h-4 w-4" aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" variant="primary" size="icon" disabled={!input.trim()} aria-label="Send">
            <ArrowUp className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </form>
    </Card>
  );
}
