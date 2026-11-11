"use client";

// Bar chart of focus sessions for the last 7 days, from GET /api/sessions/summary.

import { CloudOff } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useFocus } from "./FocusProvider";
import { weekdayLabel } from "./logic";

export function WeekChart() {
  const { summary, status } = useFocus();

  return (
    <Card aria-labelledby="week-title">
      <CardHeader
        id="week-title"
        title="This week"
        subtitle={summary ? `${summary.total} focus ${summary.total === 1 ? "session" : "sessions"}` : " "}
      />

      {status === "offline" && (
        <div className="flex h-36 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
          <CloudOff className="h-6 w-6" aria-hidden="true" />
          <p>Offline. Start the API to save and see your sessions.</p>
        </div>
      )}

      {status === "loading" && (
        <div className="flex h-36 items-end gap-2" aria-label="Loading">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded-lg bg-surface-muted" style={{ height: `${30 + i * 8}%` }} />
          ))}
        </div>
      )}

      {status === "ready" && summary && <Bars days={summary.days} />}
    </Card>
  );
}

function Bars({ days }: { days: { date: string; sessions: number; minutes: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.sessions));
  const description = days.map((d) => `${weekdayLabel(d.date)} ${d.sessions}`).join(", ");

  const empty = days.every((d) => d.sessions === 0);

  return (
    <div role="img" aria-label={`Focus sessions per day: ${description}`} className="relative">
      {empty && (
        <p className="absolute inset-x-0 top-10 text-center text-sm text-muted">
          Finish a focus session to grow your first bar.
        </p>
      )}
      <div className="flex h-36 items-end gap-2">
        {days.map((day, i) => {
          const today = i === days.length - 1;
          return (
            <div key={day.date} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={cn("text-xs font-semibold tabular-nums", day.sessions ? "text-text" : "text-transparent")}>
                {day.sessions}
              </span>
              <div
                title={`${day.sessions} sessions · ${day.minutes} min`}
                className={cn(
                  "w-full rounded-lg transition-[height] duration-500",
                  today ? "bg-linear-to-t from-primary to-primary-2" : "bg-primary/25",
                )}
                style={{ height: day.sessions ? `${(day.sessions / max) * 100}%` : "6px" }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {days.map((day, i) => (
          <span
            key={day.date}
            className={cn("flex-1 text-center text-xs", i === days.length - 1 ? "font-bold text-text" : "text-muted")}
          >
            {i === days.length - 1 ? "Today" : weekdayLabel(day.date)}
          </span>
        ))}
      </div>
    </div>
  );
}
