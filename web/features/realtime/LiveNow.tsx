"use client";

// "Live now": how many people are here and focusing, and what just happened, updated the instant it changes.

import {
  Activity as ActivityIcon,
  Swords,
  BookOpen,
  Clapperboard,
  Flame,
  Gamepad2,
  Headphones,
  Hourglass,
  Leaf,
  ListMusic,
  MessagesSquare,
  MoonStar,
  Repeat,
  Sprout,
  Sunrise,
  Timer,
  TreePine,
  Trophy,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { useRealtime } from "./RealtimeProvider";

// The server names an icon; only these are drawn (it never sends markup).
const ICONS: Record<string, LucideIcon> = {
  Timer,
  UserPlus,
  Sprout,
  Leaf,
  TreePine,
  Repeat,
  Flame,
  Hourglass,
  Sunrise,
  MoonStar,
  Headphones,
  ListMusic,
  Trophy,
  Gamepad2,
  MessagesSquare,
  Users,
  Clapperboard,
  BookOpen,
  Swords,
};

export function LivePill({ className }: { className?: string }) {
  const { connected, presence } = useRealtime();
  if (!connected || !presence) return null;
  const focusing = presence.focusing;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300",
        className,
      )}
      aria-live="polite"
    >
      <Pulse />
      {focusing > 0 ? `${focusing} focusing now` : `${presence.online} online`}
    </span>
  );
}

export function LiveNow() {
  const { connected, presence, activity } = useRealtime();
  const now = useNow(30_000); // refresh "2 min ago" every 30 s

  return (
    <Card aria-labelledby="live-title">
      <CardHeader
        id="live-title"
        title={<span className="flex items-center gap-2">Live now {connected && <Pulse />}</span>}
        subtitle={connected ? "Updates the moment something happens" : "Connecting…"}
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Stat value={presence?.online} label="here now" />
        <Stat value={presence?.focusing} label="focusing" highlight />
      </div>

      <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Recent activity</h3>
      {/* Stage 19: room for 6 rows from the start, so the page below doesn't jump when the list arrives */}
      <div className="min-h-[17rem]">
        {activity.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Finish a focus session and it shows up here for everyone.</p>
        ) : (
          <ul className="flex flex-col gap-1" aria-live="polite">
            {activity.slice(0, 6).map((a) => {
              const Icon = ICONS[a.icon] ?? ActivityIcon;
              return (
                <li key={a.id} className="flex animate-[fade-in_0.4s_ease-out] items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-muted">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{a.text}</span>
                  <time dateTime={a.at} className="shrink-0 text-xs text-muted tabular-nums">
                    {ago(a.at, now)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Stat({ value, label, highlight }: { value: number | undefined; label: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-border p-3", highlight ? "bg-emerald-500/8" : "bg-surface-muted")}>
      <p className={cn("text-2xl font-bold tabular-nums", highlight && "text-emerald-600 dark:text-emerald-300")}>{value ?? "–"}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Pulse() {
  return (
    <span className="relative inline-flex h-2 w-2" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

function useNow(everyMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

export function ago(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}
