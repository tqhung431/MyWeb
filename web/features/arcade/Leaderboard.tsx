"use client";

// One game's leaderboard: each person's best, this week or all time. Updates live
// when anyone finishes a game ("arcade:changed" from the API, Stage 6 real time).

import { CloudOff, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getBoard, type Board, type BoardPeriod } from "@/lib/api/arcade";
import { cn } from "@/lib/cn";
import { formatScore, type GameInfo } from "./games";

const PERIODS: { value: BoardPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "all", label: "All time" },
];
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboard({ game, limit = 10, version = 0, compact = false }: { game: GameInfo; limit?: number; version?: number; compact?: boolean }) {
  const [period, setPeriod] = useState<BoardPeriod>("week");
  const [board, setBoard] = useState<Board | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      setBoard(await getBoard(game.id, period));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, [game.id, period]);

  useEffect(() => {
    void load();
  }, [load, version]);

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent<{ game: string }>("arcade:changed", (e) => {
    if (e.game !== game.id || pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void load();
    }, 600);
  });

  const rows = board?.top.slice(0, limit) ?? [];
  const meShown = rows.some((r) => r.me);

  return (
    <div className="flex flex-col gap-3">
      {!compact && <SegmentedControl label={`${game.name} leaderboard period`} options={PERIODS} value={period} onChange={setPeriod} />}
      {offline && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="h-4 w-4" aria-hidden="true" /> Can&apos;t reach the API right now.
        </p>
      )}
      {!offline && board && rows.length === 0 && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <Trophy className="h-4 w-4" aria-hidden="true" /> No scores {period === "week" ? "this week" : "yet"}. Be the first!
        </p>
      )}
      {rows.length > 0 && (
        <ol className="flex flex-col gap-1" aria-label={`${game.name} top scores`}>
          {rows.map((r) => (
            <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm", r.me && "bg-primary/10 font-semibold")}>
              <span className="w-6 text-center tabular-nums">{MEDALS[r.rank - 1] ?? <span className="text-muted">{r.rank}</span>}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.me && <span className="text-primary"> (you)</span>}
              </span>
              <span className="tabular-nums">{formatScore(game, r.score)}</span>
            </li>
          ))}
        </ol>
      )}
      {board && board.best !== null && !meShown && (
        <p className="rounded-xl bg-surface-muted px-3 py-2 text-sm">
          Your best: <strong className="tabular-nums">{formatScore(game, board.best)}</strong> · #{board.rank}
        </p>
      )}
    </div>
  );
}
