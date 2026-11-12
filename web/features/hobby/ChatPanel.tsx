"use client";

// Stage 21: one chat window for both kinds of chat, so they look and behave the same:
//   Chat.tsx        a group's live chat (everyone in the group)
//   DirectChat.tsx  a private chat between two people
// The wrapper loads messages and listens for live ones; this panel shows them and sends new ones.
//
// Pictures: paste one into the box (Ctrl+V / ⌘V, or "Paste" on a phone), drop one on the chat, or
// pick one with the picture button. It's shrunk in the browser first (shrinkImage.ts), then uploaded,
// then sent with the message.

import { ArrowUp, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api/client";
import { uploadChatImage, type ChatImage } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/time";
import { MAX_MB, pictureFrom, shrinkImage } from "./shrinkImage";

import { useT } from "@/lib/i18n/I18nProvider";
export type ChatItem = {
  id: number;
  body: string;
  createdAt: string;
  image: ChatImage | null;
  mine: boolean;
  author?: { id: string; name: string }; // group chat: who wrote it
  readAt?: string | null; // private chat: when the other person saw it
};

type Props = {
  label: string; // for screen readers: "Group chat", "Chat with Mai"
  messages: ChatItem[] | null;
  more: boolean;
  onLoadOlder: () => void;
  onSend: (body: string, imageId?: string) => Promise<void>;
  onDelete: (m: ChatItem) => void;
  onTyping: () => void;
  typingNames: string[];
  placeholder: string;
  empty: ReactNode;
  // Instead of the box: "Pick a name", "Join to chat"…
  blocked?: ReactNode;
  // Group chat: a name links to a private chat with that person
  authorHref?: (authorId: string) => string | null;
  className?: string;
};

type Picture = { file: File; preview: string };

export function ChatPanel(props: Props) {
  const t = useT();
  const { messages, more, typingNames, blocked } = props;
  const [text, setText] = useState("");
  const [picture, setPicture] = useState<Picture | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState<false | "text" | "picture">(false);
  const [dragging, setDragging] = useState(false);
  const [viewing, setViewing] = useState<ChatImage | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);
  const shown = useRef<{ first?: number; height: number; top: number }>({ height: 0, top: 0 });

  // Keep the newest message in view, unless you scrolled up to read. When older messages are added on
  // top, stay on the message you were reading.
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const first = messages?.[0]?.id;
    if (shown.current.first !== undefined && first !== undefined && first < shown.current.first) {
      el.scrollTop = el.scrollHeight - shown.current.height + shown.current.top;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    shown.current = { first, height: el.scrollHeight, top: el.scrollTop };
  }, [messages, typingNames.length]);

  // Pictures load after the text: keep the bottom in view as they arrive
  function onPictureLoad() {
    const el = list.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => () => void (picture && URL.revokeObjectURL(picture.preview)), [picture]);

  function choose(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError(t("That isn't a picture."));
    if (file.size > 30 * 1024 * 1024) return setError(t("That picture is too big."));
    setError("");
    setPicture({ file, preview: URL.createObjectURL(file) });
  }

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && !picture) || sending) return;
    setSending(picture ? "picture" : "text");
    setError("");
    try {
      let imageId: string | undefined;
      if (picture) {
        const small = await shrinkImage(picture.file, picture.file.name || "picture");
        if (small.blob.size > MAX_MB * 1024 * 1024) throw new Error(t("Pictures can be up to {n} MB", { n: MAX_MB }));
        imageId = (await uploadChatImage(small.blob, small.name)).id;
      }
      await props.onSend(body, imageId);
      atBottom.current = true;
      setText("");
      setPicture(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? (err.details[0]?.message ?? err.message)
          : err instanceof Error && err.message
            ? err.message
            : t("Not sent: can't reach Nook."),
      );
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

  function onPaste(e: ClipboardEvent) {
    const file = pictureFrom(e.clipboardData);
    if (!file) return; // plain text: paste as usual
    e.preventDefault();
    choose(file);
  }

  function onDrop(e: DragEvent) {
    setDragging(false);
    if (blocked) return;
    const file = pictureFrom(e.dataTransfer);
    if (!file) return;
    e.preventDefault();
    choose(file);
  }

  const typingText =
    typingNames.length === 0
      ? ""
      : typingNames.length === 1
        ? t("{name} is typing…", { name: typingNames[0] })
        : typingNames.length === 2
          ? t("{a} and {b} are typing…", { a: typingNames[0], b: typingNames[1] })
          : t("{a}, {b} and others are typing…", { a: typingNames[0], b: typingNames[1] });
  const lastMine = messages?.findLast((m) => m.mine);

  return (
    <section
      aria-label={props.label}
      onDragOver={(e) => {
        if (blocked || !Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card backdrop-blur-xl",
        dragging && "border-primary ring-4 ring-primary/20",
        props.className,
      )}
    >
      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          shown.current.top = el.scrollTop;
        }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3 sm:p-4"
        aria-live="polite"
        aria-relevant="additions"
      >
        {more && (
          <button
            type="button"
            onClick={props.onLoadOlder}
            className="mx-auto mb-2 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            {t("Show older messages")}
          </button>
        )}
        {messages === null && <p className="m-auto text-sm text-muted">{t("Loading chat…")}</p>}
        {messages?.length === 0 && <div className="m-auto max-w-xs text-center">{props.empty}</div>}
        {messages?.map((m, i) => {
          const prev = messages[i - 1];
          const sameAuthor = prev && prev.mine === m.mine && prev.author?.id === m.author?.id;
          const first = !sameAuthor || new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60_000;
          const href = !m.mine && m.author ? props.authorHref?.(m.author.id) : null;
          return (
            <div key={m.id} className={cn("group flex flex-col", m.mine ? "items-end" : "items-start", first && i > 0 && "mt-2")}>
              {first &&
                !m.mine &&
                m.author &&
                (href ? (
                  <Link
                    href={href}
                    className="mb-0.5 px-3 text-xs font-semibold text-muted hover:text-primary hover:underline"
                    title={t("Message {name}", { name: m.author.name })}
                  >
                    {m.author.name}
                  </Link>
                ) : (
                  <span className="mb-0.5 px-3 text-xs font-semibold text-muted">{m.author.name}</span>
                ))}
              <div className={cn("flex max-w-[85%] items-end gap-1", m.mine && "flex-row-reverse")}>
                <div className={cn("flex min-w-0 flex-col gap-1", m.mine ? "items-end" : "items-start")}>
                  {m.image && (
                    <button
                      type="button"
                      onClick={() => setViewing(m.image)}
                      className="block cursor-zoom-in overflow-hidden rounded-2xl border border-border bg-surface-muted"
                      aria-label={t("Open the picture")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- a private file from the API, not a static asset */}
                      <img
                        src={m.image.url}
                        alt=""
                        width={m.image.width}
                        height={m.image.height}
                        loading="lazy"
                        onLoad={onPictureLoad}
                        className="block h-auto max-h-72 w-auto max-w-[min(16rem,100%)] object-contain"
                      />
                    </button>
                  )}
                  {m.body && (
                    <p
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                        m.mine ? "bg-linear-to-br from-primary to-primary-2 text-on-primary" : "bg-surface-strong",
                      )}
                    >
                      {m.body}
                    </p>
                  )}
                </div>
                <span className="shrink-0 pb-1 text-[10px] text-muted tabular-nums">{clockTime(m.createdAt)}</span>
                {m.mine && (
                  <button
                    type="button"
                    onClick={() => props.onDelete(m)}
                    aria-label={t("Delete this message")}
                    className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted opacity-60 hover:bg-surface-muted hover:text-rose-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              {m === lastMine && m.readAt && <span className="px-2 pt-0.5 text-[10px] font-semibold text-muted">{t("Seen")}</span>}
            </div>
          );
        })}
      </div>

      <p className="min-h-5 px-4 text-xs text-muted" aria-live="polite">
        {typingText}
      </p>

      {blocked ? (
        <div className="border-t border-border p-3">{blocked}</div>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2 border-t border-border p-2.5 sm:p-3">
          {picture && (
            <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview (blob: URL) */}
              <img src={picture.preview} alt={t("The picture you're about to send")} className="h-14 w-14 rounded-xl object-cover" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                {sending === "picture" ? t("Sending the picture…") : t("Picture ready to send")}
              </span>
              <Button variant="ghost" size="icon" onClick={() => setPicture(null)} disabled={!!sending} aria-label={t("Don't send the picture")}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInput.current?.click()}
              disabled={!!sending}
              aria-label={t("Add a picture")}
              title={t("Add a picture (or paste one)")}
            >
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                choose(e.target.files?.[0] ?? null);
                e.target.value = ""; // the same picture can be chosen again
              }}
            />
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value) props.onTyping();
              }}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              rows={1}
              maxLength={1000}
              placeholder={props.placeholder}
              aria-label={t("Message")}
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-border bg-surface-strong/70 px-4 py-2.5 text-sm [field-sizing:content] focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
            />
            <Button type="submit" variant="primary" size="icon" disabled={(!text.trim() && !picture) || !!sending} aria-label={t("Send")}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="h-5 w-5" aria-hidden="true" />}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="px-4 pb-2 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 text-sm font-semibold text-primary">
          {t("Drop the picture to send it")}
        </div>
      )}

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={t("Picture")}
        className="max-w-3xl"
        actions={
          <Button variant="secondary" onClick={() => setViewing(null)}>
            {t("Close")}
          </Button>
        }
      >
        {viewing && (
          // eslint-disable-next-line @next/next/no-img-element -- a private file from the API
          <img src={viewing.url} alt="" width={viewing.width} height={viewing.height} className="mx-auto h-auto max-h-[75svh] w-auto max-w-full rounded-2xl" />
        )}
      </Dialog>
    </section>
  );
}
