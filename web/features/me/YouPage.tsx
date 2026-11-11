"use client";

// "/account" → You (Stage 11): your name, what Nook keeps about you and for how long, and "Delete me".

import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { AchievementsCard } from "@/features/achievements/AchievementsCard";
import { TodayStats } from "@/features/focus/TodayStats";
import { deleteMe, getMyData, type MyData } from "@/lib/api/me";
import { useMe } from "./MeProvider";
import { NameForm } from "./NameForm";

const LABELS: [keyof MyData["counts"], string][] = [
  ["focusSessions", "Focus sessions"],
  ["badges", "Badges"],
  ["gameScores", "Arcade games played"],
  ["songsAdded", "Songs you added"],
  ["songLikes", "Songs you liked"],
  ["posts", "Hobby Hub posts"],
  ["comments", "Comments"],
  ["chatMessages", "Chat messages"],
  ["watchList", "On your WatchList"],
  ["habits", "Habits"],
  ["books", "Books"],
];

export function YouPage() {
  const { user, setUser, forget } = useMe();
  const [data, setData] = useState<MyData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) getMyData().then(setData, () => setData(null));
  }, [user]);

  if (!user) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">Hi there 👋</h1>
        <Card>
          <CardHeader title="What should we call you?" subtitle="Just a name, so everyone here knows who's who. No email, no password." />
          <NameForm mode="pick" onDone={setUser} />
        </Card>
      </div>
    );
  }

  const joined = new Date(user.createdAt).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" });

  async function onDelete() {
    if (!window.confirm(`Delete “${user!.name}” and everything you made on Nook? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteMe();
      forget();
    } catch {
      setDeleting(false);
      window.alert("Couldn't delete right now. Try again in a moment.");
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex items-center gap-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted">Here since {joined}</p>
        </div>
      </section>

      <Card>
        <CardHeader title="Your name" subtitle="Change it any time. Everyone sees the new name right away." />
        <NameForm key={user.name} mode="rename" initial={user.name} onDone={setUser} />
      </Card>

      <TodayStats />
      <AchievementsCard />

      <Card>
        <CardHeader title="What Nook keeps about you" subtitle="Only on this PC's database. Nothing is sent anywhere else." />
        {data ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LABELS.map(([key, label]) => (
                <div key={key} className="rounded-2xl bg-surface-muted p-3">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-xl font-bold tabular-nums">{data.counts[key]}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
              <li>
                Your name, settings (like timer lengths) and the things above. <strong className="text-text">No email, no password.</strong>
              </li>
              <li>
                If you don&apos;t open Nook for <strong className="text-text">{data.keptForDays} days</strong>, you and all of this are deleted automatically.
              </li>
              <li>
                Hobby Hub chat messages are deleted after <strong className="text-text">{data.chatKeptForDays} days</strong>.
              </li>
              <li>Songs you added stay for everyone (without your name) if you&apos;re deleted.</li>
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">Loading…</p>
        )}
      </Card>

      <Card className="border-rose-500/30">
        <CardHeader title="Delete me" subtitle="Removes your name and everything you made: history, badges, scores, posts, comments, chat." />
        <Button variant="secondary" onClick={onDelete} disabled={deleting} className="text-rose-600 dark:text-rose-300">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          Delete me and my data
        </Button>
      </Card>
    </div>
  );
}
