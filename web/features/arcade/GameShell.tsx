"use client";

// The page around every game: start screen → game → "game over" card (score saved, new best?, rank),
// with how to play and the live leaderboard next to it.
//
// Each game is its own file in ./games and is only downloaded when you open it (next/dynamic),
// so the arcade's lobby stays small.

import { ArrowLeft, Loader2, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { saveScore, type GameId, type SaveResult } from "@/lib/api/arcade";
import { cn } from "@/lib/cn";
import { formatScore, getGame, type GameInfo } from "./games";
import { Leaderboard } from "./Leaderboard";
import { isMuted, setMuted, sfx } from "./sfx";
import type { GameProps } from "./types";

const loading = () => (
  <div className="flex aspect-square items-center justify-center text-muted">
    <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
  </div>
);

const COMPONENTS: Record<GameId, ComponentType<GameProps>> = {
  worm: dynamic(() => import("./games/Worm"), { ssr: false, loading }),
  pairs: dynamic(() => import("./games/Pairs"), { ssr: false, loading }),
  bonk: dynamic(() => import("./games/Bonk"), { ssr: false, loading }),
  pancakes: dynamic(() => import("./games/Pancakes"), { ssr: false, loading }),
  reflex: dynamic(() => import("./games/Reflex"), { ssr: false, loading }),
  odd: dynamic(() => import("./games/Odd"), { ssr: false, loading }),
};

type Phase = { name: "ready" } | { name: "playing" } | { name: "over"; score: number; saved: SaveResult | "saving" | "error" };

export function GameShell({ gameId }: { gameId: GameId }) {
  const game = getGame(gameId)!;
  const Game = COMPONENTS[gameId];
  const [phase, setPhase] = useState<Phase>({ name: "ready" });
  const [round, setRound] = useState(0);
  const [boardVersion, setBoardVersion] = useState(0);
  const [muted, setMutedState] = useState(false);
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => setMutedState(isMuted()), []);

  const start = () => {
    setRound((r) => r + 1);
    setPhase({ name: "playing" });
    // Phones: bring the whole game onto the screen
    if (window.matchMedia("(max-width: 639px)").matches) board.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const finish = useCallback(
    async (score: number) => {
      setPhase({ name: "over", score, saved: "saving" });
      try {
        const saved = await saveScore(gameId, score);
        setPhase({ name: "over", score, saved });
        sfx(saved.newBest ? "win" : "lose");
        setBoardVersion((v) => v + 1);
      } catch {
        setPhase({ name: "over", score, saved: "error" });
        sfx("lose");
      }
    },
    [gameId],
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/arcade" className={buttonClasses("ghost", "sm", "-mt-2 -ml-3 self-start sm:mt-0")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All games
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="scroll-mt-20 p-3 sm:p-5" ref={board}>
          <header className="mb-3 flex items-center gap-3">
            <span className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br text-2xl", game.accent)} aria-hidden="true">
              {game.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-bold tracking-tight">{game.name}</h2>
              <p className="truncate text-sm text-muted">{game.tagline}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
              }}
              aria-pressed={muted}
              aria-label={muted ? "Turn game sounds on" : "Turn game sounds off"}
            >
              {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
            </Button>
          </header>

          <div className="relative mx-auto w-full max-w-[32rem]">
            {phase.name === "ready" ? <StartScreen game={game} onStart={start} /> : <Game key={round} onFinish={finish} />}
            {phase.name === "over" && <GameOver game={game} score={phase.score} saved={phase.saved} onAgain={start} />}
          </div>
        </Card>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardHeader title="How to play" />
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-muted">
              {game.howTo.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Leaderboard" subtitle={game.better === "lower" ? "Each person's best · lower is better" : "Each person's best"} />
            <Leaderboard game={game} version={boardVersion} />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function StartScreen({ game, onStart }: { game: GameInfo; onStart: () => void }) {
  return (
    <div className={cn("flex aspect-square flex-col items-center justify-center gap-5 rounded-2xl bg-linear-to-br p-6 text-center text-white", game.accent)}>
      <span className="animate-bounce text-7xl drop-shadow-lg sm:text-8xl" aria-hidden="true">
        {game.emoji}
      </span>
      <p className="max-w-xs text-lg font-bold drop-shadow">{game.tagline}</p>
      <Button size="lg" className="bg-white text-slate-900 shadow-xl hover:bg-white/90" onClick={onStart} autoFocus>
        <Play className="h-5 w-5" aria-hidden="true" /> Play
      </Button>
    </div>
  );
}

const QUIPS = [
  "Not bad. Not bad at all.",
  "Your thumbs deserve a snack.",
  "The leaderboard is shaking.",
  "One more? Just one. Okay, two.",
  "Somewhere, a duck is impressed.",
];

function GameOver({ game, score, saved, onAgain }: { game: GameInfo; score: number; saved: SaveResult | "saving" | "error"; onAgain: () => void }) {
  const result = typeof saved === "object" ? saved : null;
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="game-over-title"
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/85 p-6 text-center backdrop-blur-md"
    >
      <p className="text-5xl" aria-hidden="true">
        {result?.newBest ? "🏆" : "🎮"}
      </p>
      <h3 id="game-over-title" className="text-sm font-semibold tracking-wider text-muted uppercase">
        {result?.newBest ? (result.previousBest === null ? "First score!" : "New best!") : "Game over"}
      </h3>
      <p className="text-4xl font-extrabold tabular-nums">{formatScore(game, score)}</p>
      <p className="min-h-5 text-sm text-muted" aria-live="polite">
        {saved === "saving" && "Saving…"}
        {saved === "error" && "Couldn't save this score (can't reach Nook)."}
        {result &&
          (result.newBest
            ? result.rank === 1
              ? "You're #1 on Nook! 👑"
              : `You're #${result.rank} on Nook.`
            : `Your best is ${formatScore(game, result.best)} · #${result.rank} on Nook.`)}
      </p>
      <p className="text-sm italic text-muted">{quip}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button variant="primary" onClick={onAgain} autoFocus>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Play again
        </Button>
        <Link href="/arcade" className={buttonClasses("secondary")}>
          All games
        </Link>
      </div>
    </div>
  );
}
