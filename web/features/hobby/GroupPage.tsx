"use client";

// One group: its members, the board of posts and the live chat.
// Desktop: posts on the left, chat on the right. Phone: a switch between Chat and Posts.
// Stage 21: members write; while a member has the page open, everything counts as read.

import { useConfirm } from "@/components/ui/Dialog";
import { ArrowLeft, Lock, LockOpen, LogOut, MessageCircle, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { deleteGroup, getGroup, markGroupRead, setMembership, type GroupDetail } from "@/lib/api/hobby";
import { lockGroup } from "@/lib/api/admin";
import { useIsAdmin } from "@/features/admin/useIsAdmin";
import { cn } from "@/lib/cn";
import { Board } from "./Board";
import { Chat } from "./Chat";

import { useT } from "@/lib/i18n/I18nProvider";
type Tab = "chat" | "posts";

export function GroupPage({ slug }: { slug: string }) {
  const t = useT();
  const admin = useIsAdmin(); // Stage 27
  const confirm = useConfirm();
  const { user, askName } = useMe();
  const { socket } = useRealtime();
  const router = useRouter();
  const toast = useToast();
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
  useRealtimeEvent<{ slug: string; deleted?: boolean; members?: boolean }>("hobby:board", (e) => {
    if (e.slug !== slug) return;
    if (e.deleted) router.push("/hobby-hub");
    else if (e.members) void load();
    else markRead();
  });
  useRealtimeEvent<{ slug: string }>("hobby:message", (e) => e.slug === slug && markRead());

  // You're looking at it: new posts and messages here aren't "unread". Bundled, at most every 2 s.
  const joined = group?.joined ?? false;
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markRead = useCallback(() => {
    if (!joined || readTimer.current) return;
    readTimer.current = setTimeout(() => {
      readTimer.current = null;
      if (document.visibilityState === "visible") void markGroupRead(slug).catch(() => {});
    }, 2000);
  }, [joined, slug]);
  useEffect(() => {
    if (!joined) return;
    void markGroupRead(slug).catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && void markGroupRead(slug).catch(() => {});
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [joined, slug]);

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
        <p className="font-semibold">{t("This group doesn't exist (any more).")}</p>
        <Link href="/hobby-hub" className={buttonClasses("secondary", "sm")}>
          {t("All groups")}
        </Link>
      </div>
    );
  }
  if (!group) return <p className="text-sm text-muted">{t("Loading…")}</p>;

  async function setJoined(join: boolean) {
    if (!user) return askName();
    if (
      !join &&
      !(await confirm({
        title: t("Leave {group}?", { group: group!.name }),
        description: t("It moves out of Your groups and stops showing what's new. You can still read it, and join again any time."),
        confirmLabel: t("Leave"),
      }))
    )
      return;
    try {
      await setMembership(slug, join);
      toast(join ? t("You joined {group}. It's in Your groups now.", { group: group!.name }) : t("You left {group}.", { group: group!.name }));
    } catch {
      toast(t("Can't reach Nook right now."));
    }
    void load();
  }

  async function remove() {
    if (
      !(await confirm({
        title: t("Delete {group}?", { group: group!.name }),
        description: t("All its posts and chat go too. This can't be undone."),
        confirmLabel: t("Delete"),
        danger: true,
      }))
    )
      return;
    await deleteGroup(slug).catch(() => {});
    router.push("/hobby-hub");
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href="/hobby-hub" className={buttonClasses("ghost", "sm", "-ml-3 self-start")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("All groups")}
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
            {group.members.length === 0 ? (
              <span className="text-xs font-semibold text-muted">{t("No members yet")}</span>
            ) : (
              <Popover
                label={t("Members")}
                button={
                  <span className="px-1 text-xs font-semibold">
                    {group.members.length === 1 ? t("1 member") : t("{n} members", { n: group.members.length })}
                  </span>
                }
                buttonClassName="h-8 w-auto rounded-full px-2"
              >
                {() => (
                  <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                    {group.members.map((m) => (
                      <li key={m.id} className="flex items-center gap-2">
                        <Avatar name={m.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                          {m.name}
                          {m.id === user?.id && <span className="font-normal text-muted"> {t("(you)")}</span>}
                        </span>
                        {user && m.id !== user.id && (
                          <Link
                            href={`/hobby-hub/messages/${m.id}`}
                            className={buttonClasses("ghost", "sm")}
                            aria-label={t("Message {name}", { name: m.name })}
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Popover>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant={group.joined ? "secondary" : "primary"} size="sm" onClick={() => setJoined(!group.joined)}>
            {group.joined ? <LogOut className="h-4 w-4" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            {group.joined ? t("Leave") : t("Join")}
          </Button>
          {admin && (
            <Button variant="ghost" size="sm" onClick={() => lockGroup(slug, !group.locked).then((r) => setGroup({ ...group, locked: r.locked }), () => {})}>
              {group.locked ? <LockOpen className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} {group.locked ? t("Unlock") : t("Lock")}
            </Button>
          )}
          {(group.mine || admin) && (
            <Button variant="ghost" size="sm" onClick={remove} aria-label={t("Delete {group}", { group: group.name })}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>
      {group.locked && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-500/12 px-4 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <Lock className="h-4 w-4" aria-hidden="true" /> {t("The admin locked this group: you can read it, but not post or chat.")}
        </p>
      )}

      <div className="lg:hidden">
        <SegmentedControl<Tab>
          label={t("Show")}
          options={[
            { value: "chat", label: t("Chat") },
            { value: "posts", label: t("Posts") },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className={cn(tab !== "posts" && "hidden lg:block")}>
          <Board slug={slug} groupName={group.name} joined={group.joined} onJoin={() => setJoined(true)} />
        </div>
        <div className={cn("lg:sticky lg:top-6 lg:self-start", tab !== "chat" && "hidden lg:block")}>
          <Chat slug={slug} joined={group.joined} onJoin={() => setJoined(true)} className="h-[calc(100svh-22rem)] min-h-80 lg:h-[calc(100svh-12rem)]" />
        </div>
      </div>
    </div>
  );
}
