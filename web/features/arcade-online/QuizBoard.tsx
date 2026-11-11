"use client";

// Quiz Party's leaderboard: wins (against at least one other person), points and best game.

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getQuizBoard, type BoardRow } from "@/lib/api/arcadeOnline";
import { cn } from "@/lib/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

export function QuizBoard() {
  const [period, setPeriod] = useState<"week" | "all">("week");
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const load = () => getQuizBoard(period).then(setRows, () => setRows([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);
  useRealtimeEvent("ao:rooms", () => void load()); // a game ended somewhere

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <SegmentedControl<"week" | "all">
        label="Period"
        options={[
          { value: "week", label: "This week" },
          { value: "all", label: "All time" },
        ]}
        value={period}
        onChange={setPeriod}
      />
      <Card className="p-3 sm:p-4">
        {rows === null && <p className="p-3 text-sm text-muted">Loading…</p>}
        {rows?.length === 0 && <p className="p-3 text-sm text-muted">No games yet. Start a Quiz Party!</p>}
        {rows && rows.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="w-8 p-2" />
                <th className="p-2">Player</th>
                <th className="p-2 text-right">Wins</th>
                <th className="p-2 text-right">Games</th>
                <th className="hidden p-2 text-right sm:table-cell">Best</th>
                <th className="p-2 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className={cn("tabular-nums", r.me && "bg-primary/10 font-semibold")}>
                  <td className="p-2 text-center">{MEDALS[i] ?? i + 1}</td>
                  <td className="max-w-40 truncate p-2">{r.name}</td>
                  <td className="p-2 text-right font-bold">{r.wins}</td>
                  <td className="p-2 text-right">{r.games}</td>
                  <td className="hidden p-2 text-right sm:table-cell">{r.best}</td>
                  <td className="p-2 text-right">{r.points.toLocaleString("en")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-xs text-muted">A win counts when at least two people played. The server keeps the score, so it can&apos;t be faked.</p>
    </div>
  );
}
