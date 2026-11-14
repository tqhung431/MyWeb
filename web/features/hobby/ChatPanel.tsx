"use client";

// Stage 21: one chat window for both kinds of chat, so they look and behave the same:
//   Chat.tsx        a group's live chat (everyone in the group)
//   DirectChat.tsx  a private chat between two people
// The wrapper loads messages and listens for live ones; this panel shows them and sends new ones.
//
// Pictures: paste one into the box (Ctrl+V / ⌘V, or "Paste" on a phone), drop one on the chat, or
// pick one with the picture button. It's shrunk in the browser first (shrinkImage.ts), then uploaded,
// then sent with the message.

import { ArrowUp, Copy, Flag, ImagePlus, Loader2, MoreHorizontal, Pencil, Trash2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ApiError } from "@/lib/api/client";
import { uploadChatImage, type ChatImage } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { clockTime } from "@/lib/time";
import { MessageMenu, type MenuAction } from "./MessageMenu";
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
  deletedBy?: "author" | "admin" | null; // Stage 28: "Message deleted" / "Removed by the admin" in its place
  editedAt?: string | null; // Stage 28: shows "edited"
};

// Stage 28: you can change a message for 10 minutes (the API checks too; a little margin for slow clocks)
const EDIT_MS = 10 * 60_000 - 15_000;
const UNDO_MS = 5000;
const canEdit = (m: ChatItem) => m.mine && !m.deletedBy && !!m.body && Date.now() - new Date(m.createdAt).getTime() < EDIT_MS;

type Props = {
  label: string; // for screen readers: "Group chat", "Chat with Mai"
  messages: ChatItem[] | null;
  more: boolean;
  onLoadOlder: () => void;
  onSend: (body: string, imageId?: string) => Promise<void>;
  // Stage 28: called 5 seconds after Delete (unless Undo); the wrapper calls the API and marks it deleted
  onDelete: (m: ChatItem) => Promise<void>;
  onEdit?: (m: ChatItem, body: string) => Promise<void>;
  // Stage 27: the admin can delete anyone's message; others can report it
  canModerate?: boolean;
  onReport?: (m: ChatItem) => void;
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
  // Stage 28: the message menu, editing, and deletes waiting out their 5-second Undo
  const [menu, setMenu] = useState<{ m: ChatItem; anchor: HTMLElement } | null>(null);
  const [editing, setEditing] = useState<ChatItem | null>(null);
  const [pending, setPending] = useState<Map<number, ChatItem>>(new Map());
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const textarea = useRef<HTMLTextAreaElement>(null);
  const onDeleteRef = useRef(props.onDelete);
  onDeleteRef.current = props.onDelete;
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

  // Delete now, for real, once the Undo time is over (or the page is closed / left)
  const finishDelete = useCallback((m: ChatItem) => {
    clearTimeout(timers.current.get(m.id));
    timers.current.delete(m.id);
    setPending((p) => {
      const next = new Map(p);
      next.delete(m.id);
      return next;
    });
    onDeleteRef.current(m).catch(() => setError(t("Couldn't delete the message. Try again.")));
  }, [t]);

  function startDelete(m: ChatItem) {
    if (editing?.id === m.id) cancelEdit();
    setPending((p) => new Map(p).set(m.id, m));
    timers.current.set(
      m.id,
      setTimeout(() => finishDelete(m), UNDO_MS),
    );
  }

  function undoDelete(id: number) {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setPending((p) => {
      const next = new Map(p);
      next.delete(id);
      return next;
    });
  }

  // Leaving the chat or closing the tab doesn't cancel a delete
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => {
    const flush = () => pendingRef.current.forEach((m) => finishDelete(m));
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [finishDelete]);

  function startEdit(m: ChatItem) {
    setEditing(m);
    setPicture(null);
    setText(m.body);
    setError("");
    requestAnimationFrame(() => textarea.current?.focus());
  }
  function cancelEdit() {
    setEditing(null);
    setText("");
  }

  function actionsFor(m: ChatItem): MenuAction[] {
    const list: MenuAction[] = [];
    if (m.body)
      list.push({
        id: "copy",
        label: t("Copy"),
        icon: Copy,
        onSelect: () => void navigator.clipboard?.writeText(m.body).catch(() => {}),
      });
    if (props.onEdit && canEdit(m)) list.push({ id: "edit", label: t("Edit"), icon: Pencil, onSelect: () => startEdit(m) });
    if (m.mine || props.canModerate) list.push({ id: "delete", label: t("Delete"), icon: Trash2, danger: true, onSelect: () => startDelete(m) });
    if (!m.mine && props.onReport) list.push({ id: "report", label: t("Report"), icon: Flag, onSelect: () => props.onReport!(m) });
    return list;
  }

  function openMenu(m: ChatItem, anchor: HTMLElement) {
    if (m.deletedBy || pending.has(m.id) || actionsFor(m).length === 0) return;
    setMenu((open) => (open?.m.id === m.id ? null : { m, anchor }));
  }

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
    if (editing) {
      if (!body || sending) return;
      if (body === editing.body) return cancelEdit();
      setSending("text");
      try {
        await props.onEdit?.(editing, body);
        cancelEdit();
      } catch (err) {
        setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : t("Not sent: can't reach Nook."));
      } finally {
        setSending(false);
      }
      return;
    }
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
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      return cancelEdit();
    }
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
          const waiting = pending.has(m.id);
          const gone = m.deletedBy ?? (waiting ? (m.mine ? "author" : "admin") : null);
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
              {gone ? (
                // Stage 28: a deleted message keeps its place, so the chat still makes sense
                <p
                  className={cn(
                    "flex max-w-[85%] items-center gap-2 rounded-2xl border border-dashed border-border px-3.5 py-2 text-sm text-muted italic",
                    m.mine && "flex-row-reverse",
                  )}
                >
                  {gone === "admin" ? t("Removed by the admin") : t("Message deleted")}
                  {waiting && (
                    <button
                      type="button"
                      onClick={() => undoDelete(m.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-primary not-italic hover:bg-primary/10"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> {t("Undo")}
                    </button>
                  )}
                </p>
              ) : (
                <div className={cn("flex max-w-[85%] items-end gap-1", m.mine && "flex-row-reverse")}>
                  <div
                    className={cn("flex min-w-0 flex-col gap-1", m.mine ? "items-end" : "items-start")}
                    onContextMenu={(e) => {
                      if (actionsFor(m).length === 0) return;
                      e.preventDefault(); // right-click: Nook's menu instead of the browser's
                      openMenu(m, e.currentTarget);
                    }}
                  >
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
                        onPointerUp={(e) => {
                          // a tap on a phone opens the menu; with a mouse, text stays selectable (right-click or ⋯)
                          if (e.pointerType !== "mouse" && !window.getSelection()?.toString()) openMenu(m, e.currentTarget);
                        }}
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-sm break-words whitespace-pre-wrap",
                          m.mine ? "bg-linear-to-br from-primary to-primary-2 text-on-primary" : "bg-surface-strong",
                          editing?.id === m.id && "ring-2 ring-amber-400",
                        )}
                      >
                        {m.body}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 pb-1 text-[10px] text-muted tabular-nums">
                    {m.editedAt && <span className="mr-1">{t("edited")}</span>}
                    {clockTime(m.createdAt)}
                  </span>
                  {actionsFor(m).length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => openMenu(m, e.currentTarget)}
                      aria-label={t("Message options")}
                      aria-haspopup="menu"
                      aria-expanded={menu?.m.id === m.id}
                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted opacity-60 hover:bg-surface-muted hover:text-text focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 aria-expanded:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              {m === lastMine && !gone && m.readAt && <span className="px-2 pt-0.5 text-[10px] font-semibold text-muted">{t("Seen")}</span>}
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
          {editing && (
            <div className="flex items-center gap-2 rounded-2xl bg-amber-400/15 px-3 py-1.5 text-xs font-semibold">
              <Pencil className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{t("Editing your message")}</span>
              <button type="button" onClick={cancelEdit} className="cursor-pointer rounded-full px-2 py-0.5 text-muted hover:bg-surface-muted hover:text-text">
                {t("Cancel")}
              </button>
            </div>
          )}
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
              disabled={!!sending || !!editing}
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
              ref={textarea}
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
            <Button
              type="submit"
              variant="primary"
              size="icon"
              disabled={(!text.trim() && !picture) || !!sending}
              aria-label={editing ? t("Save the change") : t("Send")}
            >
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

      {menu && <MessageMenu anchor={menu.anchor} label={t("Message options")} actions={actionsFor(menu.m)} onClose={() => setMenu(null)} />}

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
