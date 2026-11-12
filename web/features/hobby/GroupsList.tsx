"use client";

// Hobby Hub's front page: every group, with members, posts and when it was last busy.
// Anyone can read; starting a group needs a name.

import { CloudOff, Loader2, MessageCircle, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useMe } from "@/features/me/MeProvider";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { ApiError } from "@/lib/api/client";
import { createGroup, getGroups, type Group } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";

const EMOJIS = ["🎲", "🎸", "🌱", "🐶", "📷", "✈️", "🎨", "🧶", "♟️", "🏸", "🍰", "🚲"];

export function GroupsList() {
  const { user, askName } = useMe();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await getGroups());
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, user?.id]);
  useRealtimeEvent("hobby:groups", () => void load());
  useRealtimeEvent("hobby:unread", () => void load()); // Stage 21: new posts/messages in your groups

  const mine = groups?.filter((g) => g.joined) ?? [];
  const others = groups?.filter((g) => !g.joined) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">
          Groups for what you love. Join one to post, comment and chat; your groups come first and show what&apos;s new.
        </p>
        <Button variant="primary" onClick={() => (user ? setCreating(true) : askName())}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Start a group
        </Button>
      </div>

      {creating && <NewGroup onClose={() => setCreating(false)} />}

      {offline && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-5 w-5" aria-hidden="true" /> Can&apos;t reach the API right now.
        </p>
      )}
      {!offline && groups === null && <p className="text-sm text-muted">Loading groups…</p>}

      {mine.length > 0 && <Section title="Your groups" groups={mine} />}
      {others.length > 0 && <Section title={mine.length ? "More groups" : "All groups"} groups={others} />}
    </div>
  );
}

function Section({ title, groups }: { title: string; groups: Group[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">{title}</h2>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id}>
            <GroupCard group={g} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GroupCard({ group }: { group: Group }) {
  return (
    <Link
      href={`/hobby-hub/${group.slug}`}
      className="flex h-full flex-col gap-3 rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl transition hover:-translate-y-1 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400/25 to-teal-500/25 text-3xl"
          aria-hidden="true"
        >
          {group.emoji}
        </span>
        {group.unread > 0 ? <Badge tone="danger">{group.unread > 99 ? "99+" : group.unread} new</Badge> : group.joined && <Badge tone="success">Joined</Badge>}
      </span>
      <span>
        <span className="block font-bold">{group.name}</span>
        {group.description && <span className="mt-1 line-clamp-2 block text-sm text-muted">{group.description}</span>}
      </span>
      <span className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted">
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" aria-hidden="true" /> {group.members} {group.members === 1 ? "member" : "members"}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> {group.posts} {group.posts === 1 ? "post" : "posts"}
        </span>
        {group.lastActivity && <span>Active {timeAgo(group.lastActivity)}</span>}
      </span>
    </Link>
  );
}

function NewGroup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const group = await createGroup({ name, emoji, description });
      router.push(`/hobby-hub/${group.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Can't reach Nook right now.");
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Start a group" subtitle="Anyone on this Nook can find it and join." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Board Games" autoFocus error={error} />
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Emoji</legend>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
                aria-label={`Emoji ${e}`}
                className={cn(
                  "inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border text-2xl transition",
                  emoji === e ? "border-primary bg-primary/12" : "border-border hover:bg-surface-muted",
                )}
              >
                {e}
              </button>
            ))}
            <input
              value={EMOJIS.includes(emoji) ? "" : emoji}
              onChange={(e) => setEmoji(e.target.value.trim() || EMOJIS[0])}
              maxLength={8}
              placeholder="or type one"
              aria-label="Or type your own emoji"
              className="h-11 w-28 rounded-xl border border-border bg-surface-strong/70 px-3 text-center focus:border-primary focus:outline-none"
            />
          </div>
        </fieldset>
        <Input
          label="What's it about? (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="One line"
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Create
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
