"use client";

// Stage 22: chess in your browser: against Nook (the computer, thinking in a Web Worker) or two people taking
// turns on one screen. No game server needed, so it works offline. Games against Nook are saved when they end
// (if you have a name); they don't change ratings.

import { Chess } from "chess.js";
import { Bot, Flag, Loader2, RotateCcw, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { sfx } from "@/features/arcade/sfx";
import { useMe } from "@/features/me/MeProvider";
import { saveNookGame } from "@/lib/api/arena";
import { tx } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { Board, type MoveInput } from "./Board";
import type { Level } from "./engine";
import { capturedBy, MoveList, PlayerStrip, useResultText } from "./parts";

const LEVEL_NAMES = [tx("Sprout"), tx("Walker"), tx("Climber"), tx("Summit")];

type Props = { mode: "nook"; level: Level; color: "w" | "b" } | { mode: "local" };

function resultOf(c: Chess): { result: "1-0" | "0-1" | "1/2-1/2"; reason: string } | null {
  if (c.isCheckmate()) return { result: c.turn() === "w" ? "0-1" : "1-0", reason: "checkmate" };
  if (c.isStalemate()) return { result: "1/2-1/2", reason: "stalemate" };
  if (c.isInsufficientMaterial()) return { result: "1/2-1/2", reason: "insufficient" };
  if (c.isThreefoldRepetition()) return { result: "1/2-1/2", reason: "repetition" };
  if (c.isDrawByFiftyMoves()) return { result: "1/2-1/2", reason: "fifty-moves" };
  return null;
}

export function ChessLocal(props: Props) {
  const t = useT();
  const { user } = useMe();
  const confirm = useConfirm();
  const resultText = useResultText();
  const [game] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [thinking, setThinking] = useState(false);
  const [resigned, setResigned] = useState(false);
  const [saved, setSaved] = useState<"no" | "saving" | "yes">("no");
  const worker = useRef<Worker | null>(null);
  const asked = useRef(0);

  const nook = props.mode === "nook";
  const myColor = nook ? props.color : null;
  const result = useMemo(() => {
    void fen; // recompute after every move
    if (resigned && myColor) return { result: myColor === "w" ? ("0-1" as const) : ("1-0" as const), reason: "resign" };
    return resultOf(game);
  }, [fen, resigned, game, myColor]);

  const names = {
    w: nook ? (props.color === "w" ? (user?.name ?? t("You")) : `Nook · ${t(LEVEL_NAMES[props.level - 1])}`) : t("White"),
    b: nook ? (props.color === "b" ? (user?.name ?? t("You")) : `Nook · ${t(LEVEL_NAMES[props.level - 1])}`) : t("Black"),
  };

  const apply = useCallback(
    (m: MoveInput) => {
      try {
        const played = game.move(m);
        setLastMove({ from: played.from, to: played.to });
        setFen(game.fen());
        sfx(game.isCheckmate() ? "win" : game.inCheck() ? "bonk" : "drop");
        return true;
      } catch {
        return false;
      }
    },
    [game],
  );

  // Nook's turn: ask the worker
  useEffect(() => {
    if (!nook || result || game.turn() === props.color) return;
    if (!worker.current) worker.current = new Worker(new URL("./engine.worker.ts", import.meta.url));
    const id = ++asked.current;
    setThinking(true);
    const started = performance.now();
    worker.current.onmessage = (e: MessageEvent<{ id: number; move: MoveInput | null }>) => {
      if (e.data.id !== asked.current) return;
      // Level 1–2 answer instantly; a short pause feels more like a person
      const wait = Math.max(0, 450 - (performance.now() - started));
      setTimeout(() => {
        if (e.data.id !== asked.current) return;
        setThinking(false);
        if (e.data.move) apply(e.data.move);
      }, wait);
    };
    worker.current.postMessage({ id, fen: game.fen(), level: props.level });
  }, [fen, nook, result, game, apply, props]);
  useEffect(() => () => worker.current?.terminate(), []);

  // Save a finished game against Nook
  useEffect(() => {
    if (!nook || !result || !user || saved !== "no") return;
    setSaved("saving");
    saveNookGame({ pgn: game.pgn(), level: props.level, color: props.color, resigned }).then(
      () => setSaved("yes"),
      () => setSaved("no"),
    );
  }, [nook, result, user, saved, game, props, resigned]);

  const restart = () => {
    asked.current++;
    game.reset();
    setFen(game.fen());
    setLastMove(null);
    setThinking(false);
    setResigned(false);
    setSaved("no");
  };
  const takeBack = () => {
    asked.current++;
    setThinking(false);
    game.undo();
    if (nook && game.turn() !== props.color) game.undo(); // take back Nook's answer too
    const h = game.history({ verbose: true }).at(-1);
    setLastMove(h ? { from: h.from, to: h.to } : null);
    setFen(game.fen());
  };
  const resign = async () => {
    if (await confirm({ title: t("Resign this game?"), confirmLabel: t("Resign"), danger: true })) {
      asked.current++;
      setThinking(false);
      setResigned(true);
    }
  };

  const orientation = nook ? props.color : game.turn();
  const top = orientation === "w" ? "b" : "w";
  const taken = capturedBy(fen);
  const turn = game.turn();
  const canMove = result ? null : nook ? (turn === props.color && !thinking ? props.color : null) : turn;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        <PlayerStrip name={names[top]} color={top} active={!result && turn === top} captured={taken[top]}>
          {nook && top !== props.color && thinking && <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Nook is thinking…")} />}
        </PlayerStrip>
        <Board fen={fen} orientation={orientation} canMove={canMove} onMove={apply} lastMove={lastMove} />
        <PlayerStrip name={names[orientation]} color={orientation} active={!result && turn === orientation} captured={taken[orientation]} />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-linear-to-br from-slate-700 to-violet-700 text-white">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold">{nook ? t("Playing Nook · level {n}", { n: props.level }) : t("Two players, one screen")}</p>
              <p className="text-sm text-muted">{nook ? t(LEVEL_NAMES[props.level - 1]) : t("The board turns after each move.")}</p>
            </div>
          </div>
          {result ? (
            <div className="mt-4 rounded-2xl bg-primary/10 p-4">
              <p className="text-lg font-extrabold">{resultText(result, names.w, names.b)}</p>
              {nook && user && <p className="mt-1 text-xs text-muted">{saved === "yes" ? t("Saved to recent games.") : saved === "saving" ? t("Saving…") : ""}</p>}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{thinking ? t("Nook is thinking…") : turn === "w" ? t("White to move") : t("Black to move")}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!result && (
              <Button size="sm" variant="secondary" onClick={takeBack} disabled={game.history().length === 0 || thinking}>
                <Undo2 className="h-4 w-4" aria-hidden="true" /> {t("Take back")}
              </Button>
            )}
            {!result && nook && (
              <Button size="sm" variant="secondary" onClick={resign}>
                <Flag className="h-4 w-4" aria-hidden="true" /> {t("Resign")}
              </Button>
            )}
            <Button size="sm" variant={result ? "primary" : "secondary"} onClick={restart}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> {t("New game")}
            </Button>
            <Link href="/arena/chess" className={buttonClasses("ghost", "sm")}>
              {t("Back to chess")}
            </Link>
          </div>
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-bold">{t("Moves")}</h3>
          <MoveList moves={game.history()} />
        </Card>
      </div>
    </div>
  );
}
