"use client";

// Stage 30: every leaderboard on Nook in one place (Games → Leaderboards). Pick a game; the address keeps it
// (#quiz, #chess…) so a link can open the right one. The quick games show all six side by side.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GAMES } from "@/features/arcade/games";
import { Leaderboard as ArcadeBoard } from "@/features/arcade/Leaderboard";
import { QuizBoard } from "@/features/arcade-online/QuizBoard";
import { MAP_NAMES } from "@/features/arena/village/names";
import { MAP_IDS, type MapId } from "@/features/arena/village/village";
import { Leaderboard as CloudPathBoard } from "@/features/games/van-lo/ui/Leaderboard";
import { getAlleyBoard, getBrawlBoard, getChessBoard, getVillageBoard } from "@/lib/api/arena";
import { getLeaderboard } from "@/lib/api/games";
import { cn } from "@/lib/cn";
import { tx } from "@/lib/i18n/core";
import { useLang, useT } from "@/lib/i18n/I18nProvider";

const BOARDS = [
  { id: "quick", label: tx("Quick games") },
  { id: "quiz", label: tx("Quiz Party") },
  { id: "chess", label: tx("Chess") },
  { id: "alley", label: tx("Firecracker Alley") },
  { id: "village", label: tx("Keep the Village") },
  { id: "brawl", label: tx("Night Market Brawl") },
  { id: "cloud", label: tx("Cloud Path") },
  { id: "sprout", label: tx("Sproutlings") },
] as const;
type BoardId = (typeof BOARDS)[number]["id"];
const MEDALS = ["🥇", "🥈", "🥉"];

export function Leaderboards() {
  const t = useT();
  const [board, setBoard] = useState<BoardId>("quick");
  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    if (BOARDS.some((b) => b.id === fromHash)) setBoard(fromHash as BoardId);
  }, []);
  function pick(id: BoardId) {
    setBoard(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("Leaderboards")} className="flex flex-wrap gap-2">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={board === b.id}
            onClick={() => pick(b.id)}
            className={cn(
              "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
              board === b.id ? "border-primary bg-primary/10 text-text" : "border-border text-muted hover:text-text",
            )}
          >
            {t(b.label)}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {board === "quick" && <QuickBoards />}
        {board === "quiz" && <QuizBoard />}
        {board === "chess" && <ChessBoard />}
        {board === "alley" && <AlleyBoard />}
        {board === "village" && <VillageBoard />}
        {board === "brawl" && <BrawlBoard />}
        {board === "cloud" && <CloudBoard />}
        {board === "sprout" && <SproutBoard />}
      </div>
    </div>
  );
}

function QuickBoards() {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {GAMES.map((game) => (
        <Card key={game.id} className="flex flex-col gap-4">
          <Link href={`/arcade/${game.id}`} className="flex items-center gap-3 rounded-2xl hover:opacity-80">
            <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-2xl", game.accent)} aria-hidden="true">
              {game.emoji}
            </span>
            <span>
              <span className="block font-bold">{t(game.name)}</span>
              <span className="block text-xs text-muted">{game.better === "lower" ? t("Lower is better") : t("Higher is better")}</span>
            </span>
          </Link>
          <ArcadeBoard game={game} limit={5} />
        </Card>
      ))}
    </div>
  );
}

// A simple ranked list: name on the left, the numbers that matter on the right
type Row = { rank: number; name: string; me: boolean; right: ReactNode; detail?: ReactNode };
function RankList({ rows, empty, play }: { rows: Row[] | null; empty: string; play: string }) {
  const t = useT();
  return (
    <Card className="max-w-2xl">
      {rows === null && <p className="text-sm text-muted">{t("Loading…")}</p>}
      {rows?.length === 0 && (
        <p className="text-sm text-muted">
          {empty}{" "}
          <Link href={play} className="font-semibold text-primary hover:underline">
            {t("Play")}
          </Link>
        </p>
      )}
      {rows && rows.length > 0 && (
        <ol className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={`${r.rank}-${r.name}`} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2", r.me && "bg-primary/10")}>
              <span className="w-7 text-center font-bold tabular-nums">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {r.name}
                  {r.me && <span className="font-normal text-muted"> {t("(you)")}</span>}
                </span>
                {r.detail && <span className="block text-xs text-muted">{r.detail}</span>}
              </span>
              <span className="shrink-0 text-right text-sm font-bold tabular-nums">{r.right}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function useRows<T>(load: () => Promise<T[]>, toRow: (r: T) => Row, deps: unknown[] = []) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    setRows(null);
    load().then(
      (list) => setRows(list.map(toRow)),
      () => setRows([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return rows;
}

function ChessBoard() {
  const t = useT();
  const rows = useRows(getChessBoard, (r) => ({
    ...r,
    right: r.rating,
    detail: t("{w} wins · {d} draws · {l} losses", { w: r.wins, d: r.draws, l: r.losses }),
  }));
  return <RankList rows={rows} empty={t("No rated games yet.")} play="/arena/chess" />;
}

function AlleyBoard() {
  const t = useT();
  const rows = useRows(getAlleyBoard, (r) => ({ ...r, right: t("{n} wins", { n: r.wins }), detail: t("{n} games", { n: r.games }) }));
  return <RankList rows={rows} empty={t("No matches yet.")} play="/arena/alley" />;
}

function VillageBoard() {
  const t = useT();
  const [map, setMap] = useState<MapId>("riverside");
  const rows = useRows(
    () => getVillageBoard(map),
    (r) => ({ ...r, right: r.score, detail: t("{n} waves", { n: r.waves }) }),
    [map],
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="max-w-md">
        <SegmentedControl<MapId> label={t("Map")} value={map} onChange={setMap} options={MAP_IDS.map((m) => ({ value: m, label: t(MAP_NAMES[m]) }))} />
      </div>
      <RankList rows={rows} empty={t("No scores on this map yet.")} play="/arena/village" />
    </div>
  );
}

const clock = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function BrawlBoard() {
  const t = useT();
  const rows = useRows(getBrawlBoard, (r) => ({
    ...r,
    right: r.wins > 0 && r.best ? clock(r.best) : t("area {n}", { n: r.areas }),
    detail: t("{n} runs · {w} cleared", { n: r.runs, w: r.wins }),
  }));
  return <RankList rows={rows} empty={t("No runs yet.")} play="/arena/brawl" />;
}

function CloudBoard() {
  const lang = useLang();
  return <CloudPathBoard lang={lang} />;
}

function SproutBoard() {
  const t = useT();
  const rows = useRows(
    () => getLeaderboard("sprout"),
    (r) => ({ ...r, right: `🏮 ${r.level}`, detail: t("{n} kinds of sproutling befriended", { n: r.kills }) }),
  );
  return <RankList rows={rows} empty={t("Nobody has woken a shrine yet.")} play="/arena/sprout" />;
}
