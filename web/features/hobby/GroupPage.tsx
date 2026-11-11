"use client";

// One group: its members, the board of posts and the live chat.
// Desktop: posts on the left, chat on the right. Phone: a switch between Chat and Posts.

import { ArrowLeft, LogOut, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { deleteGroup, getGroup, setMembership, type GroupDetail } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { Board } from "./Board";
import { Chat } from "./Chat";

type Tab = "chat" | "posts";

export function GroupPage({ slug }: { slug: string }) {
  const { user, askName } = useMe();
  const { socket } = useRealtime();
  const router = useRouter();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");

  const load = useCallback(async () => {
    try {
      setGroup(await getGroup(slug));
    } catch {
      setMissing(true);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load, user?.id]);
  useRealtimeEvent("hobby:groups", () => void load()); // someone joined or left
  useRealtimeEvent("people:changed", () => void load());
  useRealtimeEvent<{ slug: string; deleted?: boolean }>("hobby:board", (e) => {
    if (e.slug === slug && e.deleted) router.push("/hobby-hub");
  });

  // Join this group's live room while the page is open (and again after reconnecting)
  useEffect(() => {
    if (!socket) return;
    const join = () => socket.emit("hobby:join", { slug });
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
      socket.emit("hobby:leave", { slug });
    };
  }, [socket, slug]);

  if (missing) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="font-semibold">This group doesn&apos;t exist (any more).</p>
        <Link href="/hobby-hub" className={buttonClasses("secondary", "sm")}>
          All groups
        </Link>
      </div>
    );
  }
  if (!group) return <p className="text-sm text-muted">Loading…</p>;

  async function toggleJoin() {
    if (!user) return askName();
    await setMembership(slug, !group!.joined).catch(() => {});
    void load();
  }

  async function remove() {
    if (!window.confirm(`Delete ${group!.name} with all its posts and chat? This can't be undone.`)) return;
    await deleteGroup(slug).catch(() => {});
    router.push("/hobby-hub");
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/hobby-hub" className={buttonClasses("ghost", "sm", "-ml-3 self-start")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All groups
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-linear-to-br from-emerald-400/25 to-teal-500/25 text-4xl"
          aria-hidden="true"
        >
          {group.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
          {group.description && <p className="text-sm text-muted">{group.description}</p>}
          <div className="mt-2 flex items-center gap-2">
            <span className="flex -space-x-2" aria-hidden="true">
              {group.members.slice(0, 5).map((m) => (
                <span key={m.id} className="rounded-full ring-2 ring-background" title={m.name}>
                  <Avatar name={m.name} size="sm" />
                </span>
              ))}
            </span>
            <span className="text-xs font-semibold text-muted" title={group.members.map((m) => m.name).join(", ")}>
              {group.members.length === 0 ? "No members yet" : `${group.members.length} ${group.members.length === 1 ? "member" : "members"}`}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={group.joined ? "secondary" : "primary"} size="sm" onClick={toggleJoin}>
            {group.joined ? <LogOut className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            {group.joined ? "Leave" : "Join"}
          </Button>
          {group.mine && (
            <Button variant="ghost" size="sm" onClick={remove} aria-label={`Delete ${group.name}`}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div className="lg:hidden">
        <SegmentedControl<Tab>
          label="Show"
          options={[
            { value: "chat", label: "Chat" },
            { value: "posts", label: "Posts" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={cn(tab !== "posts" && "hidden lg:block")}>
          <Board slug={slug} groupName={group.name} />
        </div>
        <div className={cn("lg:sticky lg:top-6 lg:self-start", tab !== "chat" && "hidden lg:block")}>
          <Chat slug={slug} className="h-[calc(100svh-22rem)] min-h-80 lg:h-[calc(100svh-12rem)]" />
        </div>
      </div>
    </div>
  );
}
