"use client";

// Stage 22: small pieces every chess screen shares: the player strip with its clock, the move list, the result line.

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { tx } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";

const REASONS: Record<string, string> = {
  checkmate: tx("checkmate"),
  resign: tx("resigned"),
  time: tx("out of time"),
  stalemate: tx("stalemate"),
  repetition: tx("same position three times"),
  insufficient: tx("not enough pieces to mate"),
  "fifty-moves": tx("50 moves without a capture"),
  agreement: tx("agreed draw"),
  abandoned: tx("left the game"),
  draw: tx("draw"),
};

export function useResultText() {
  const t = useT();
  return (result: { result: string; reason: string }, white: string, black: string) => {
    const why = t(REASONS[result.reason] ?? result.reason);
    if (result.result === "1/2-1/2") return t("Draw · {why}", { why });
    return t("{name} wins · {why}", { name: result.result === "1-0" ? white : black, why });
  };
}

export function formatClock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 20 && ms > 0) return `0:${(ms / 1000).toFixed(1).padStart(4, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A clock that counts down smoothly between server updates. `running`: this side is thinking. */
export function Clock({ ms, running, at, serverNow }: { ms: number; running: boolean; at: number; serverNow: () => number }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => force((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [running]);
  const left = running ? ms - (serverNow() - at) : ms;
  return (
    <span
      className={cn(
        "min-w-[4.5rem] rounded-xl px-2.5 py-1 text-center font-mono text-lg font-bold tabular-nums",
        running ? "bg-text text-background" : "bg-surface-muted text-muted",
        running && left < 20_000 && "bg-rose-600 text-white",
      )}
    >
      {formatClock(left)}
    </span>
  );
}

export function PlayerStrip({ name, color, active, children, captured }: { name: string; color: "w" | "b"; active: boolean; children?: React.ReactNode; captured?: string }) {
  const t = useT();
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-2 transition", active ? "bg-primary/10 ring-1 ring-primary/30" : "")}>
      <Avatar name={name} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="text-xs text-muted">
          {color === "w" ? t("White") : t("Black")}
          {captured ? <span className="ml-2 tracking-tighter">{captured}</span> : null}
        </p>
      </div>
      {children}
    </div>
  );
}

export function MoveList({ moves, current, onPick }: { moves: string[]; current?: number; onPick?: (ply: number) => void }) {
  const t = useT();
  if (moves.length === 0) return <p className="text-sm text-muted">{t("No moves yet")}</p>;
  const rows: [string, string | undefined][] = [];
  for (let i = 0; i < moves.length; i += 2) rows.push([moves[i], moves[i + 1]]);
  const cell = (san: string | undefined, ply: number) =>
    san ? (
      <button
        type="button"
        disabled={!onPick}
        onClick={() => onPick?.(ply)}
        className={cn("rounded-md px-1.5 py-0.5 text-left font-mono text-sm enabled:cursor-pointer enabled:hover:bg-surface-muted", current === ply && "bg-primary/15 font-bold")}
      >
        {san}
      </button>
    ) : (
      <span />
    );
  return (
    <ol className="grid max-h-64 grid-cols-[2rem_1fr_1fr] gap-x-1 gap-y-0.5 overflow-y-auto text-sm">
      {rows.map(([w, b], i) => (
        <li key={i} className="contents">
          <span className="py-0.5 text-right text-xs text-muted tabular-nums">{i + 1}.</span>
          {cell(w, i * 2 + 1)}
          {cell(b, i * 2 + 2)}
        </li>
      ))}
    </ol>
  );
}

const SYMBOLS: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" };
const START_COUNT: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };

/** The pieces each side has taken, from the board in a FEN (e.g. "♟♟♞") */
export function capturedBy(fen: string): { w: string; b: string } {
  const placement = fen.split(" ")[0];
  const count = (ch: string) => [...placement].filter((c) => c === ch).length;
  const missing = (color: "w" | "b") =>
    Object.keys(START_COUNT)
      .map((type) => SYMBOLS[type].repeat(Math.max(0, START_COUNT[type] - count(color === "w" ? type.toUpperCase() : type))))
      .join("");
  return { w: missing("b"), b: missing("w") }; // white took black's missing pieces
}
