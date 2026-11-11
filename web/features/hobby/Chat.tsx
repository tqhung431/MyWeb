"use client";

// A group's live chat. History comes from the API; new messages arrive over Socket.IO
// ("hobby:message"), so everyone with the group open sees them the moment they're sent.
// "Linh is typing…" is sent through the socket too, and never stored.

import { useConfirm } from "@/components/ui/Dialog";
import { ArrowUp, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { ApiError } from "@/lib/api/client";
import { deleteMessage, getMessages, sendMessage, type Message } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/time";

const TYPING_MS = 3500;

export function Chat({ slug, className }: { slug: string; className?: string }) {
  const confirm = useConfirm();
  const { user, askName } = useMe();
  const { socket } = useRealtime();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [more, setMore] = useState(false);
  const [typing, setTyping] = useState<Record<string, number>>({}); // name → shown until
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const keepOffset = useRef<number | null>(null); // after loading older messages, stay where you were
  const lastTyping = useRef(0);

  const load = useCallback(async () => {
    try {
      const page = await getMessages(slug);
      atBottom.current = true;
      setMessages(page.messages);
      setMore(page.more);
    } catch {
      setMessages((m) => m ?? []);
    }
  }, [slug]);

  useEffect(() => {
    setMessages(null);
    void load();
  }, [load]);

  // Reconnected after a network blip: catch up on what was missed
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => void load();
    socket.on("connect", onConnect);
    return () => void socket.off("connect", onConnect);
  }, [socket, load]);

  useRealtimeEvent<{ slug: string; message: Message }>("hobby:message", ({ slug: s, message }) => {
    if (s !== slug) return;
    setMessages((list) => (list && !list.some((m) => m.id === message.id) ? [...list, message] : list));
    setTyping(({ [message.author.name]: _, ...rest }) => rest);
  });
  useRealtimeEvent<{ slug: string; id: number }>("hobby:message-deleted", ({ slug: s, id }) => {
    if (s === slug) setMessages((list) => list?.filter((m) => m.id !== id) ?? null);
  });
  useRealtimeEvent<{ slug: string; name: string }>("hobby:typing", ({ slug: s, name }) => {
    if (s === slug && name !== user?.name) setTyping((t) => ({ ...t, [name]: Date.now() + TYPING_MS }));
  });
  useRealtimeEvent("people:changed", () => void load()); // someone renamed or left

  // Forget "typing…" after a few quiet seconds
  useEffect(() => {
    if (!Object.keys(typing).length) return;
    const id = setInterval(() => setTyping((t) => Object.fromEntries(Object.entries(t).filter(([, until]) => until > Date.now()))), 1000);
    return () => clearInterval(id);
  }, [typing]);

  // Keep the newest message in view (unless you scrolled up to read)
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing]);

  async function loadOlder() {
    if (!messages?.length) return;
    const page = await getMessages(slug, messages[0].id).catch(() => null);
    if (!page) return;
    keepOffset.current = list.current ? list.current.scrollHeight - list.current.scrollTop : null;
    setMessages((m) => [...page.messages, ...(m ?? [])]);
    setMore(page.more);
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const m = await sendMessage(slug, body);
      atBottom.current = true;
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
      setText("");
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Not sent: can't reach Nook.");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault(); // Enter sends, Shift+Enter makes a new line
      void send();
    }
  }

  function onType(value: string) {
    setText(value);
    if (socket && value && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      socket.emit("hobby:typing", { slug });
    }
  }

  async function remove(m: Message) {
    if (!(await confirm({ title: "Delete this message?", confirmLabel: "Delete", danger: true }))) return;
    await deleteMessage(m.id).catch(() => {});
    setMessages((list) => list?.filter((x) => x.id !== m.id) ?? null);
  }

  const typingNames = Object.keys(typing);

  return (
    <section
      aria-label="Group chat"
      className={cn("flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card backdrop-blur-xl", className)}
    >
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 sm:p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {more && (
          <button
            type="button"
            onClick={loadOlder}
            className="mx-auto mb-2 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            Show older messages
          </button>
        )}
        {messages === null && <p className="m-auto text-sm text-muted">Loading chat…</p>}
        {messages?.length === 0 && (
          <div className="m-auto max-w-xs text-center">
            <p className="text-4xl" aria-hidden="true">
              💬
            </p>
            <p className="mt-2 font-semibold">No messages yet</p>
            <p className="text-sm text-muted">Say hi! Messages are kept for 30 days.</p>
          </div>
        )}
        {messages?.map((m, i) => {
          const mine = m.author.id === user?.id;
          const prev = messages[i - 1];
          const first = !prev || prev.author.id !== m.author.id || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
          return (
            <div key={m.id} className={cn("group flex flex-col", mine ? "items-end" : "items-start", first && i > 0 && "mt-2")}>
              {first && !mine && <span className="mb-0.5 px-3 text-xs font-semibold text-muted">{m.author.name}</span>}
              <div className={cn("flex max-w-[85%] items-end gap-1", mine && "flex-row-reverse")}>
                <p
                  className={cn(
                    "rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                    mine ? "bg-linear-to-br from-primary to-primary-2 text-on-primary" : "bg-surface-strong",
                  )}
                >
                  {m.body}
                </p>
                <span className="shrink-0 pb-1 text-[10px] text-muted tabular-nums">{clockTime(m.createdAt)}</span>
                {mine && (
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    aria-label="Delete this message"
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted opacity-60 hover:bg-surface-muted hover:text-rose-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="min-h-5 px-4 text-xs text-muted" aria-live="polite">
        {typingNames.length > 0 &&
          `${typingNames.slice(0, 2).join(" and ")}${typingNames.length > 2 ? " and others" : ""} ${typingNames.length === 1 ? "is" : "are"} typing…`}
      </p>

      {user ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-2.5 sm:p-3">
          <textarea
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={1000}
            placeholder={`Message as ${user.name}`}
            aria-label="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface-strong/70 px-4 py-2.5 text-sm [field-sizing:content] focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
          />
          <Button type="submit" variant="primary" size="icon" disabled={!text.trim() || sending} aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
          </Button>
        </form>
      ) : (
        <div className="border-t border-border p-3">
          <Button variant="primary" className="w-full" onClick={askName}>
            Pick a name to chat
          </Button>
        </div>
      )}
      {error && <p className="px-4 pb-2 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </section>
  );
}
