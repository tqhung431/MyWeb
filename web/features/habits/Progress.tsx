"use client";

// Progress: 12 weeks per habit, one square per day (darker = done), like a calendar seen from far away.

import { useEffect, useState } from "react";
import { addDays, getHabits, type Habit } from "@/lib/api/habits";
import { cn } from "@/lib/cn";
import { COLOR, mondayOf, WEEKDAYS } from "./colors";

import { useT } from "@/lib/i18n/I18nProvider";
const WEEKS = 12;

export function Progress() {
  const t = useT();
  const [data, setData] = useState<{ today: string; habits: Habit[] } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    getHabits(WEEKS).then(setData, () => setError(true));
  }, []);

  if (error) return <p className="text-sm text-muted">{t("Can't reach Nook right now, or you haven't picked a name yet.")}</p>;
  if (!data) return <p className="text-sm text-muted">{t("Loading…")}</p>;
  if (data.habits.length === 0) return <p className="text-sm text-muted">{t("Add a habit on the Today tab first.")}</p>;

  const firstMonday = addDays(mondayOf(data.today), -(WEEKS - 1) * 7);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {data.habits.map((h) => {
        const done = new Set(h.days);
        const total = h.days.length;
        return (
          <section
            key={h.id}
            className="rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl"
            aria-label={t("{name}: {n} days in {weeks} weeks", { name: h.name, n: total, weeks: WEEKS })}
          >
            <header className="mb-4 flex items-center gap-3">
              <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl", COLOR[h.color].soft)} aria-hidden="true">
                {h.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold">{h.name}</h2>
                <p className="text-xs text-muted">
                  {total} {total === 1 ? "day" : "days"} in {WEEKS} weeks · 🔥 {h.streak.count} {h.streak.unit}
                  {h.streak.count === 1 ? "" : "s"} in a row
                </p>
              </div>
            </header>
            {/* One grid: a column of weekday labels, then a column per week; cells fill top to bottom */}
            <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `auto repeat(${WEEKS}, minmax(0, 1fr))` }} aria-hidden="true">
              {WEEKDAYS.map((d, i) => (
                <span key={`label-${i}`} className="flex items-center pr-1 text-[10px] leading-none text-muted">
                  {i % 2 === 0 ? d : ""}
                </span>
              ))}
              {Array.from({ length: WEEKS * 7 }, (_, i) => {
                const day = addDays(firstMonday, i);
                const future = day > data.today;
                return (
                  <span
                    key={day}
                    title={day}
                    className={cn(
                      "aspect-square rounded-[4px]",
                      future ? "bg-transparent" : done.has(day) ? COLOR[h.color].cell : "bg-surface-muted",
                      day === data.today && "ring-2 ring-primary/60",
                    )}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
