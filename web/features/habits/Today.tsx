"use client";

// Today: your habits with a big tick for today, this week's days, and your streak.
// Ticking works offline too: it's kept on this device and sent when the connection is back.

import { useConfirm } from "@/components/ui/Dialog";
import { Check, CloudOff, Flame, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { NameForm } from "@/features/me/NameForm";
import { useMe } from "@/features/me/MeProvider";
import { addDays, createHabit, deleteHabit, getHabits, setHabitDay, todayHere, updateHabit, type Habit } from "@/lib/api/habits";
import { currentLang, LOCALE } from "@/lib/i18n/core";
import { cn } from "@/lib/cn";
import { COLOR, mondayOf, WEEKDAYS } from "./colors";
import { HabitForm } from "./HabitForm";
import { ReminderSwitch } from "./Reminders";

import { useT } from "@/lib/i18n/I18nProvider";
const CACHE = "nook.habits"; // the last list, shown when offline

export function Today() {
  const t = useT();
  const confirm = useConfirm();
  const { user, setUser } = useMe();
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [today, setToday] = useState(todayHere());
  const [offline, setOffline] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getHabits();
      setHabits(res.habits);
      setToday(res.today);
      setOffline(false);
      localStorage.setItem(CACHE, JSON.stringify(res.habits));
    } catch {
      setOffline(true);
      try {
        setHabits((h) => h ?? (JSON.parse(localStorage.getItem(CACHE) ?? "null") as Habit[] | null) ?? []);
      } catch {
        setHabits((h) => h ?? []);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    window.addEventListener("online", load);
    return () => window.removeEventListener("online", load);
  }, [load, user]);

  if (!user) {
    return (
      <div className="max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">{t("Pick a name to track habits")}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{t("Your habits are private: only you see them.")}</p>
        <NameForm mode="pick" onDone={setUser} />
      </div>
    );
  }

  async function toggle(h: Habit, day: string) {
    const done = !h.days.includes(day);
    // Show it at once (also offline), fix the numbers when the API answers
    const days = done ? [...h.days, day].sort() : h.days.filter((d) => d !== day);
    const optimistic = { ...h, days, doneToday: day === today ? done : h.doneToday, thisWeek: h.thisWeek + (day >= mondayOf(today) ? (done ? 1 : -1) : 0) };
    setHabits((list) => list?.map((x) => (x.id === h.id ? optimistic : x)) ?? null);
    const r = await setHabitDay(h.id, day, done).catch(() => null);
    if (r?.sent) setHabits((list) => list?.map((x) => (x.id === h.id ? { ...optimistic, streak: r.value.streak, thisWeek: r.value.thisWeek } : x)) ?? null);
    else if (r && !r.sent) setOffline(true);
  }

  const doneCount = habits?.filter((h) => h.doneToday).length ?? 0;
  const monday = mondayOf(today);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {habits?.length ? (
            <>
              {t("{n} of {total} done today", { n: doneCount, total: habits.length })}
              {doneCount === habits.length && habits.length > 0 ? " 🎉" : ""}
            </>
          ) : (
            t("Small things, every day.")
          )}
        </p>
        <div className="flex gap-2">
          <ReminderSwitch />
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {t("New habit")}
          </Button>
        </div>
      </div>
      {offline && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-800 dark:text-amber-200">
          <CloudOff className="h-4 w-4 shrink-0" aria-hidden="true" /> {t("Offline: your ticks are kept on this device and sent when Nook is back.")}
        </p>
      )}
      {adding && (
        <HabitForm
          onSave={async (h) => {
            await createHabit(h);
            setAdding(false);
            await load();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {habits === null && <p className="text-sm text-muted">{t("Loading…")}</p>}
      {habits?.length === 0 && !adding && (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-4xl" aria-hidden="true">
            🌱
          </p>
          <p className="mt-2 font-semibold">{t("No habits yet")}</p>
          <p className="text-sm text-muted">{t("Start with one small thing, like “read 10 pages” or “drink water”.")}</p>
        </div>
      )}

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {habits?.map((h) =>
          editing === h.id ? (
            <li key={h.id} className="md:col-span-2">
              <HabitForm
                initial={h}
                onSave={async (changes) => {
                  await updateHabit(h.id, changes);
                  setEditing(null);
                  await load();
                }}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={h.id} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl sm:p-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggle(h, today)}
                  aria-pressed={h.doneToday}
                  aria-label={h.doneToday ? t("{name}: done today. Undo", { name: h.name }) : t("Mark {name} done today", { name: h.name })}
                  className={cn(
                    "inline-flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-2xl text-2xl transition active:scale-95",
                    h.doneToday ? cn(COLOR[h.color].solid, "text-white shadow-lg") : cn(COLOR[h.color].soft, "hover:brightness-95"),
                  )}
                >
                  {h.doneToday ? <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" /> : h.emoji}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-semibold", h.doneToday && "text-muted line-through decoration-2")}>{h.name}</p>
                  <p className="text-xs text-muted">
                    {h.perWeek === 7 ? t("Every day") : t("{n} of {total} this week", { n: h.thisWeek, total: h.perWeek })}
                    {h.reminderTime && ` · ⏰ ${h.reminderTime}`}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums",
                    h.streak.count ? "bg-orange-500/12 text-orange-600 dark:text-orange-300" : "text-muted",
                  )}
                  title={t("Streak")}
                >
                  <Flame className="h-4 w-4" aria-hidden="true" />
                  {h.streak.count}
                  <span className="text-xs font-semibold">{h.streak.unit === "day" ? "d" : "wk"}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-1" role="group" aria-label={t("{name} this week", { name: h.name })}>
                {WEEKDAYS.map((label, i) => {
                  const day = addDays(monday, i);
                  const done = h.days.includes(day);
                  const future = day > today;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={future}
                      onClick={() => toggle(h, day)}
                      aria-pressed={done}
                      aria-label={`${new Date(`${day}T12:00:00Z`).toLocaleDateString(LOCALE[currentLang()], { weekday: "long", day: "numeric", month: "short" })}${done ? `, ${t("done")}` : ""}`}
                      className={cn(
                        "flex h-10 flex-1 cursor-pointer flex-col items-center justify-center rounded-xl text-[11px] font-semibold transition disabled:cursor-default disabled:opacity-40",
                        done ? cn(COLOR[h.color].solid, "text-white") : "bg-surface-muted text-muted hover:text-text",
                        day === today && !done && "ring-2 ring-inset ring-primary/40",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="-mb-1 flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(h.id)} aria-label={t("Change {name}", { name: h.name })}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={t("Delete {name}", { name: h.name })}
                  onClick={async () => {
                    if (!(await confirm({ title: t("Delete “{name}” and its history?", { name: h.name }), confirmLabel: t("Delete"), danger: true }))) return;
                    await deleteHabit(h.id).catch(() => {});
                    void load();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
