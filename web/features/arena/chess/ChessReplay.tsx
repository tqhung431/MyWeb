"use client";

// Stage 22: replay a finished game move by move (arrow keys work too).

import { Chess } from "chess.js";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getChessGame, type ChessGameFull } from "@/lib/api/arena";
import { useT } from "@/lib/i18n/I18nProvider";
import { Board } from "./Board";
import { capturedBy, MoveList, PlayerStrip, useResultText } from "./parts";

export function ChessReplay({ id }: { id: number }) {
  const t = useT();
  const resultText = useResultText();
  const [game, setGame] = useState<ChessGameFull | null>(null);
  const [failed, setFailed] = useState(false);
  const [ply, setPly] = useState(0);

  useEffect(() => {
    getChessGame(id).then(setGame, () => setFailed(true));
  }, [id]);

  const positions = useMemo(() => {
    if (!game) return [];
    const c = new Chess();
    c.loadPgn(game.pgn);
    const history = c.history({ verbose: true });
    const out = [{ fen: history[0]?.before ?? c.fen(), last: null as { from: string; to: string } | null }];
    for (const m of history) out.push({ fen: m.after, last: { from: m.from, to: m.to } });
    return out;
  }, [game]);
  const moves = useMemo(() => {
    if (!game) return [];
    const c = new Chess();
    c.loadPgn(game.pgn);
    return c.history();
  }, [game]);

  // Start at the end (the final position)
  useEffect(() => setPly(positions.length - 1), [positions.length]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
      if (e.key === "ArrowRight") setPly((p) => Math.min(positions.length - 1, p + 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [positions.length]);

  if (failed) return <p className="text-muted">{t("Game not found")}</p>;
  if (!game || positions.length === 0) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;

  const here = positions[Math.min(ply, positions.length - 1)];
  const taken = capturedBy(here.fen);
  const download = () => {
    const url = URL.createObjectURL(new Blob([game.pgn], { type: "application/x-chess-pgn" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `nook-chess-${game.id}.pgn` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        <PlayerStrip name={game.blackName} color="b" active={false} captured={taken.b} />
        <Board fen={here.fen} orientation="w" canMove={null} lastMove={here.last} />
        <PlayerStrip name={game.whiteName} color="w" active={false} captured={taken.w} />
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="secondary" aria-label={t("First move")} onClick={() => setPly(0)}>
            <ChevronFirst className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="secondary" aria-label={t("Back")} onClick={() => setPly((p) => Math.max(0, p - 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="grid min-w-16 place-items-center text-sm font-semibold tabular-nums">
            {ply}/{positions.length - 1}
          </span>
          <Button size="sm" variant="secondary" aria-label={t("Next")} onClick={() => setPly((p) => Math.min(positions.length - 1, p + 1))}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="secondary" aria-label={t("Last move")} onClick={() => setPly(positions.length - 1)}>
            <ChevronLast className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <p className="text-lg font-extrabold">{resultText(game, game.whiteName, game.blackName)}</p>
          <p className="mt-1 text-sm text-muted">
            {game.mode === "nook" ? t("Against Nook") : t("Live game")} · {new Date(game.endedAt).toLocaleString()}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={download}>
              <Download className="h-4 w-4" aria-hidden="true" /> {t("Download PGN")}
            </Button>
            <Link href="/arena/chess" className={buttonClasses("ghost", "sm")}>
              {t("Back to chess")}
            </Link>
          </div>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-bold">{t("Moves")}</h3>
          <MoveList moves={moves} current={ply} onPick={setPly} />
        </Card>
      </div>
    </div>
  );
}
