"use client";

// A group's live chat. History comes from the API; new messages arrive over Socket.IO
// ("hobby:message"), so everyone with the group open sees them the moment they're sent.
// "Linh is typing…" is sent through the socket too, and never stored.
// Stage 21: the window itself is ChatPanel (shared with private chats); only members can write.

import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Dialog";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { deleteMessage, getMessages, sendMessage, type Message } from "@/lib/api/hobby";
import { ChatPanel, type ChatItem } from "./ChatPanel";
import { useTyping } from "./useTyping";

export function Chat({ slug, joined, onJoin, className }: { slug: string; joined: boolean; onJoin: () => void; className?: string }) {
  const confirm = useConfirm();
  const { user, askName } = useMe();
  const { socket } = useRealtime();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [more, setMore] = useState(false);
  const typing = useTyping(user?.name);
  const lastTyping = useRef(0);

  const load = useCallback(async () => {
    try {
      const page = await getMessages(slug);
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
    typing.stopped(message.author.name);
  });
  useRealtimeEvent<{ slug: string; id: number }>("hobby:message-deleted", ({ slug: s, id }) => {
    if (s === slug) setMessages((list) => list?.filter((m) => m.id !== id) ?? null);
  });
  useRealtimeEvent<{ slug: string; name: string }>("hobby:typing", ({ slug: s, name }) => {
    if (s === slug) typing.started(name);
  });
  useRealtimeEvent("people:changed", () => void load()); // someone renamed or left

  async function loadOlder() {
    if (!messages?.length) return;
    const page = await getMessages(slug, messages[0].id).catch(() => null);
    if (!page) return;
    setMessages((m) => [...page.messages, ...(m ?? [])]);
    setMore(page.more);
  }

  async function send(body: string, imageId?: string) {
    const m = await sendMessage(slug, body, imageId);
    setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
  }

  async function remove(m: ChatItem) {
    if (!(await confirm({ title: "Delete this message?", confirmLabel: "Delete", danger: true }))) return;
    await deleteMessage(m.id).catch(() => {});
    setMessages((list) => list?.filter((x) => x.id !== m.id) ?? null);
  }

  function onTyping() {
    if (socket && Date.now() - lastTyping.current > 2000) {
      lastTyping.current = Date.now();
      socket.emit("hobby:typing", { slug });
    }
  }

  const items: ChatItem[] | null = messages?.map((m) => ({ ...m, mine: m.author.id === user?.id })) ?? null;

  return (
    <ChatPanel
      label="Group chat"
      className={className}
      messages={items}
      more={more}
      onLoadOlder={loadOlder}
      onSend={send}
      onDelete={remove}
      onTyping={onTyping}
      typingNames={typing.names}
      placeholder={user ? `Message as ${user.name}` : ""}
      authorHref={(id) => (user ? `/hobby-hub/messages/${id}` : null)}
      empty={
        <>
          <p className="text-4xl" aria-hidden="true">
            💬
          </p>
          <p className="mt-2 font-semibold">No messages yet</p>
          <p className="text-sm text-muted">Say hi! Messages are kept for 30 days.</p>
        </>
      }
      blocked={
        !user ? (
          <Button variant="primary" className="w-full" onClick={askName}>
            Pick a name to chat
          </Button>
        ) : !joined ? (
          <Button variant="primary" className="w-full" onClick={onJoin}>
            <UserPlus className="h-4 w-4" aria-hidden="true" /> Join to chat
          </Button>
        ) : undefined
      }
    />
  );
}
