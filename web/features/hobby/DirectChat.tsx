"use client";

// Stage 21: a private chat between you and one other person.
// Messages arrive live in each person's own room ("dm:message"), so it works across all your tabs and
// devices. Opening the chat marks it as read, and the other person sees "Seen" under their message.

import { useReport } from "@/features/admin/useReport";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import {
  deleteDirectMessage,
  editDirectMessage,
  getDirectMessages,
  markDirectRead,
  sendDirectMessage,
  type DeletedBy,
  type DirectMessage,
  type Edited,
  type Person,
} from "@/lib/api/hobby";
import { ChatPanel, type ChatItem } from "./ChatPanel";
import { useTyping } from "./useTyping";

import { useT } from "@/lib/i18n/I18nProvider";
export function DirectChat({ userId }: { userId: string }) {
  const t = useT();
  const reportIt = useReport(); // Stage 27
  const { user, askName } = useMe();
  const { socket } = useRealtime();
  const [person, setPerson] = useState<Person | null>(null);
  const [messages, setMessages] = useState<DirectMessage[] | null>(null);
  const [more, setMore] = useState(false);
  const [missing, setMissing] = useState(false);
  const typing = useTyping(user?.name);
  const lastTyping = useRef(0);

  const markRead = useCallback(() => {
    if (document.visibilityState === "visible") void markDirectRead(userId).catch(() => {});
  }, [userId]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const page = await getDirectMessages(userId);
      setPerson(page.person);
      setMessages(page.messages);
      setMore(page.more);
      if (page.messages.some((m) => !m.mine && !m.readAt)) markRead();
    } catch {
      setMissing(true);
    }
  }, [userId, user, markRead]);

  useEffect(() => {
    setMessages(null);
    setMissing(false);
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => void load();
    socket.on("connect", onConnect);
    document.addEventListener("visibilitychange", markRead);
    return () => {
      socket.off("connect", onConnect);
      document.removeEventListener("visibilitychange", markRead);
    };
  }, [socket, load, markRead]);

  useRealtimeEvent<{ with: string; from: Person; message: DirectMessage }>("dm:message", (e) => {
    if (e.with !== userId) return;
    setMessages((list) => (list && !list.some((m) => m.id === e.message.id) ? [...list, e.message] : list));
    if (!e.message.mine) {
      typing.stopped(e.from.name);
      markRead();
    }
  });
  // Stage 28: "Message deleted" stays in its place; edits show "edited"
  const markDeleted = (id: number, by: DeletedBy) =>
    setMessages((list) => list?.map((m) => (m.id === id ? { ...m, body: "", image: null, deletedBy: by ?? "author", editedAt: null } : m)) ?? null);
  const markEdited = (e: Edited) => setMessages((list) => list?.map((m) => (m.id === e.id ? { ...m, body: e.body, editedAt: e.editedAt } : m)) ?? null);
  useRealtimeEvent<{ with: string; id: number; by?: DeletedBy }>("dm:deleted", (e) => {
    if (e.with === userId) markDeleted(e.id, e.by ?? "author");
  });
  useRealtimeEvent<{ with: string } & Edited>("dm:edited", ({ with: w, ...e }) => {
    if (w === userId) markEdited(e);
  });
  // They read your messages: show "Seen"
  useRealtimeEvent<{ with: string; by: string }>("dm:read", (e) => {
    if (e.with === userId && e.by === userId) {
      const now = new Date().toISOString();
      setMessages((list) => list?.map((m) => (m.mine && !m.readAt ? { ...m, readAt: now } : m)) ?? null);
    }
  });
  useRealtimeEvent<{ from: string; name: string }>("dm:typing", (e) => {
    if (e.from === userId) typing.started(e.name);
  });

  async function loadOlder() {
    if (!messages?.length) return;
    const page = await getDirectMessages(userId, messages[0].id).catch(() => null);
    if (!page) return;
    setMessages((m) => [...page.messages, ...(m ?? [])]);
    setMore(page.more);
  }

  async function send(body: string, imageId?: string) {
    const m = await sendDirectMessage(userId, body, imageId);
    setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
  }

  // Stage 28: ChatPanel gives 5 seconds to Undo, then calls this
  async function remove(m: ChatItem) {
    await deleteDirectMessage(m.id);
    markDeleted(m.id, "author");
  }

  async function edit(m: ChatItem, body: string) {
    markEdited(await editDirectMessage(m.id, body));
  }

  function onTyping() {
    if (socket && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      socket.emit("dm:typing", { to: userId });
    }
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-3 p-2">
        <p className="font-semibold">{t("Pick a name to chat privately.")}</p>
        <button type="button" onClick={askName} className={buttonClasses("primary", "sm")}>
          {t("Pick a name")}
        </button>
      </div>
    );
  }
  if (missing) {
    return (
      <div className="flex flex-col items-start gap-3 p-2">
        <p className="font-semibold">{t("This person isn't on Nook any more.")}</p>
        <Link href="/messages" className={buttonClasses("secondary", "sm")}>
          {t("All messages")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-3">
        <Link href="/messages" className={buttonClasses("ghost", "icon", "lg:hidden")} aria-label={t("All messages")}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        {person && <Avatar name={person.name} size="md" />}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{person?.name ?? "…"}</h2>
          <p className="text-xs text-muted">{t("Private: only the two of you see this chat. Kept for 30 days.")}</p>
        </div>
      </div>
      <ChatPanel
        label={person ? t("Chat with {name}", { name: person.name }) : t("Private chat")}
        className="min-h-0 flex-1"
        messages={messages?.map((m) => ({ ...m })) ?? null}
        more={more}
        onLoadOlder={loadOlder}
        onSend={send}
        onDelete={remove}
        onEdit={edit}
        onReport={(m) => void reportIt("dm", m.id)}
        onTyping={onTyping}
        typingNames={typing.names}
        placeholder={person ? t("Message {name}", { name: person.name }) : t("Message")}
        empty={
          <>
            <p className="text-4xl" aria-hidden="true">
              👋
            </p>
            <p className="mt-2 font-semibold">{t("Start the conversation")}</p>
            <p className="text-sm text-muted">{t("Say hi, or paste a picture.")}</p>
          </>
        }
      />
    </div>
  );
}
