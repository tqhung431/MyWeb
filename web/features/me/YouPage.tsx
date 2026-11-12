"use client";

// "/account" → You (Stage 11): your name, what Nook keeps about you and for how long, and "Delete me".

import { useConfirm } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { Loader2, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { AchievementsCard } from "@/features/achievements/AchievementsCard";
import { TodayStats } from "@/features/focus/TodayStats";
import { deleteMe, getMyData, type MyData } from "@/lib/api/me";
import { useMe } from "./MeProvider";
import { LOCALE } from "@/lib/i18n/core";
import { useLang } from "@/lib/i18n/I18nProvider";
import { NameForm } from "./NameForm";

import { useT } from "@/lib/i18n/I18nProvider";
import { tx } from "@/lib/i18n/core";
const LABELS: [keyof MyData["counts"], string][] = [
  ["focusSessions", tx("Focus sessions")],
  ["badges", tx("Badges")],
  ["gameScores", tx("Arcade games played")],
  ["songsAdded", tx("Songs you added")],
  ["songLikes", tx("Songs you liked")],
  ["posts", tx("Hobby Hub posts")],
  ["comments", tx("Comments")],
  ["chatMessages", tx("Chat messages")],
  ["privateMessages", tx("Private messages sent")],
  ["chatPictures", tx("Chat pictures")],
  ["watchList", tx("On your WatchList")],
  ["habits", tx("Habits")],
  ["books", tx("Books")],
  ["quizGames", tx("Quiz Party games")],
];

export function YouPage() {
  const t = useT();
  const confirm = useConfirm();
  const toast = useToast();
  const { user, setUser, forget } = useMe();
  const lang = useLang();
  const [data, setData] = useState<MyData | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) getMyData().then(setData, () => setData(null));
  }, [user]);

  if (!user) {
    return (
      <div className="flex max-w-xl flex-col gap-6">
        <h1 className="text-3xl font-bold tracking-tight">{t("Hi there 👋")}</h1>
        <Card>
          <CardHeader title={t("What should we call you?")} subtitle={t("Just a name, so everyone here knows who's who. No email, no password.")} />
          <NameForm mode="pick" onDone={setUser} />
        </Card>
      </div>
    );
  }

  const joined = new Date(user.createdAt).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", year: "numeric" });

  async function onDelete() {
    if (
      !(await confirm({
        title: t("Delete “{name}”?", { name: user!.name }),
        description: t("Everything you made on Nook goes too. This can't be undone."),
        confirmLabel: t("Delete"),
        danger: true,
      }))
    )
      return;
    setDeleting(true);
    try {
      await deleteMe();
      forget();
    } catch {
      setDeleting(false);
      toast(t("Couldn't delete right now. Try again in a moment."), { tone: "error" });
    }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="flex items-center gap-5">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-muted">{t("Here since {date}", { date: joined })}</p>
        </div>
      </section>

      <Card>
        <CardHeader title={t("Your name")} subtitle={t("Change it any time. Everyone sees the new name right away.")} />
        <NameForm key={user.name} mode="rename" initial={user.name} onDone={setUser} />
      </Card>

      <Link href="/settings" className={buttonClasses("secondary", "md", "self-start")}>
        <Settings className="h-4 w-4" aria-hidden="true" /> {t("Settings: language and colours")}
      </Link>
      <TodayStats />
      <AchievementsCard />

      <Card>
        <CardHeader title={t("What Nook keeps about you")} subtitle={t("Only on this PC's database. Nothing is sent anywhere else.")} />
        {data ? (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LABELS.map(([key, label]) => (
                <div key={key} className="rounded-2xl bg-surface-muted p-3">
                  <dt className="text-xs text-muted">{t(label)}</dt>
                  <dd className="text-xl font-bold tabular-nums">{data.counts[key]}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-5 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
              <li>
                {t("Your name, settings (like timer lengths) and the things above.")} <strong className="text-text">{t("No email, no password.")}</strong>
              </li>
              <li>{t("If you don't open Nook for {n} days, you and all of this are deleted automatically.", { n: data.keptForDays })}</li>
              <li>{t("Hobby Hub chats (group and private) and their pictures are deleted after {n} days.", { n: data.chatKeptForDays })}</li>
              <li>{t("Songs you added stay for everyone (without your name) if you're deleted.")}</li>
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">{t("Loading…")}</p>
        )}
      </Card>

      <Card className="border-rose-500/30">
        <CardHeader title={t("Delete me")} subtitle={t("Removes your name and everything you made: history, badges, scores, posts, comments, chat.")} />
        <Button variant="secondary" onClick={onDelete} disabled={deleting} className="text-rose-600 dark:text-rose-300">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
          {t("Delete me and my data")}
        </Button>
      </Card>
    </div>
  );
}
