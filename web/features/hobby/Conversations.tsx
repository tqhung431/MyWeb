"use client";

// Stage 21: your private chats, newest first, and a search to start a new one.

import { ImageIcon, PenSquare, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useMe } from "@/features/me/MeProvider";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { findPeople, getConversations, type Conversation, type Person } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";
import { UnreadDot } from "./UnreadProvider";

import { useT } from "@/lib/i18n/I18nProvider";
export function Conversations({ className }: { className?: string }) {
  const t = useT();
  const { user, askName } = useMe();
  const pathname = usePathname();
  const [list, setList] = useState<Conversation[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    if (!user) return setList([]);
    setList(await getConversations().catch(() => []));
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeEvent("dm:message", () => void load());
  useRealtimeEvent("dm:read", () => void load());
  useRealtimeEvent("dm:deleted", () => void load());
  useRealtimeEvent("people:changed", () => void load());

  if (!user) {
    return (
      <div className={cn("flex flex-col items-start gap-3 rounded-3xl border border-border bg-surface p-5", className)}>
        <p className="font-semibold">{t("Private chats")}</p>
        <p className="text-sm text-muted">{t("Pick a name to send private messages to people on this Nook.")}</p>
        <Button variant="primary" size="sm" onClick={askName}>
          {t("Pick a name")}
        </Button>
      </div>
    );
  }

  return (
    <section aria-label={t("Private chats")} className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wider text-muted uppercase">{t("Private chats")}</h2>
        <Button variant={searching ? "secondary" : "primary"} size="sm" onClick={() => setSearching((s) => !s)}>
          {searching ? <X className="h-4 w-4" aria-hidden="true" /> : <PenSquare className="h-4 w-4" aria-hidden="true" />}
          {searching ? t("Close") : t("New")}
        </Button>
      </div>

      {searching && <PeopleSearch />}

      {list === null && <p className="text-sm text-muted">{t("Loading…")}</p>}
      {list?.length === 0 && !searching && (
        <div className="rounded-3xl border border-dashed border-border p-6 text-center">
          <p className="text-4xl" aria-hidden="true">
            ✉️
          </p>
          <p className="mt-2 font-semibold">{t("No private chats yet")}</p>
          <p className="text-sm text-muted">{t("Tap New, or a name in a group chat, to start one.")}</p>
        </div>
      )}
      <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto">
        {list?.map((c) => {
          const active = pathname === `/messages/${c.id}`;
          return (
            <li key={c.id}>
              <Link
                href={`/messages/${c.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-2.5 transition",
                  active ? "bg-primary/12" : "hover:bg-surface-muted",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                )}
              >
                <Avatar name={c.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate", c.unread ? "font-bold" : "font-semibold")}>{c.name}</span>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.lastAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-sm", c.unread ? "font-semibold text-text" : "text-muted")}>
                      {c.lastMine && t("You: ")}
                      {c.lastDeleted ? (
                        <span className="italic">{t("Message deleted")}</span>
                      ) : c.lastImage && !c.lastBody ? (
                        <span className="inline-flex items-center gap-1">
                          <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> {t("Picture")}
                        </span>
                      ) : (
                        c.lastBody
                      )}
                    </span>
                    <UnreadDot count={c.unread} />
                    {c.unread > 0 && <span className="sr-only">{t("{n} unread", { n: c.unread })}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PeopleSearch() {
  const t = useT();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => findPeople(q).then(setPeople, () => setPeople([])), q ? 200 : 0);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-3">
      <label className="flex items-center gap-2 rounded-2xl border border-border bg-surface-strong/70 px-3 focus-within:border-primary">
        <Search className="h-4 w-4 text-muted" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Find someone by name")}
          aria-label={t("Find someone by name")}
          autoFocus
          maxLength={40}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
      </label>
      {people?.length === 0 && <p className="px-1 text-sm text-muted">{q ? t("Nobody with that name.") : t("Nobody else has picked a name yet.")}</p>}
      <ul className="flex max-h-64 flex-col overflow-y-auto">
        {people?.map((p) => (
          <li key={p.id}>
            <Link href={`/messages/${p.id}`} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-muted">
              <Avatar name={p.name} size="sm" />
              <span className="truncate text-sm font-semibold">{p.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
