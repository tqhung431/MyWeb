"use client";

// Stage 22: a live chess room. The game server holds the real game; this page draws what it sends
// ("room:state") and sends your moves. Your own move shows at once (chess.js checks it here too),
// and the server's answer replaces it a moment later.

import { Chess } from "chess.js";
import { Check, Copy, Flag, Handshake, Loader2, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { sfx } from "@/features/arcade/sfx";
import { useArena, useArenaEvent, useArenaRoom } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import type { ChessRoomState } from "@/lib/api/arena";
import { useT } from "@/lib/i18n/I18nProvider";
import { Board, type MoveInput } from "./Board";
import { capturedBy, Clock, MoveList, PlayerStrip, useResultText } from "./parts";

export function ChessRoom({ code }: { code: string }) {
  const t = useT();
  const { user } = useMe();
  const { ask, serverNow } = useArena();
  const confirm = useConfirm();
  const resultText = useResultText();
  const [state, setState] = useState<ChessRoomState | null>(null);
  const [pending, setPending] = useState<string | null>(null); // FEN after my move, until the server answers
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const receivedAt = useRef(0); // server time when the last state arrived (clocks count from here)

  useArenaRoom(code, setError);
  const last = useRef<ChessRoomState | null>(null);
  useArenaEvent<ChessRoomState>("room:state", (s) => {
    if (s.code !== code || s.kind !== "chess") return;
    receivedAt.current = s.chess?.serverNow ?? serverNow();
    const old = last.current?.chess;
    if (s.chess && old && s.chess.moves.length > old.moves.length) sfx(s.chess.inCheck ? "bonk" : "drop");
    if (s.chess?.result && !old?.result) sfx(s.chess.result.result === "1/2-1/2" ? "go" : mySide(s) && winnerSide(s) === mySide(s) ? "win" : "lose");
    last.current = s;
    setPending(null);
    setState(s);
  });

  // Ask before leaving a game in progress
  const g = state?.chess;
  const me = user ? (g?.white.id === user.id ? "w" : g?.black.id === user.id ? "b" : null) : null;
  useEffect(() => {
    if (!me || !g || g.result) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [me, g]);

  if (!user && !state) return <NeedName why={t("Pick a name to play. Without one you can only watch.")} />;

  const play = async (m: MoveInput) => {
    if (!g) return;
    const c = new Chess(g.fen);
    try {
      c.move(m);
    } catch {
      return;
    }
    setPending(c.fen());
    sfx("drop");
    const a = await ask("chess:move", { code, ...m });
    if (!a.ok) {
      setPending(null);
      setError(a.error ?? t("That move isn't allowed"));
    }
  };
  const act = async (event: string) => {
    const a = await ask(event, { code });
    if (!a.ok && a.error) setError(a.error);
  };
  const resign = async () => {
    if (await confirm({ title: t("Resign this game?"), confirmLabel: t("Resign"), danger: true })) void act("chess:resign");
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/arena/chess/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!state) {
    return (
      <div className="flex items-center gap-2 text-muted">
        {error ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" /> {error}{" "}
            <Link href="/arena/chess" className="font-semibold text-primary">
              {t("Back to chess")}
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("Joining…")}
          </>
        )}
      </div>
    );
  }

  const orientation = me ?? "w";
  const top = orientation === "w" ? "b" : "w";
  const bottom = orientation;
  const seatName = (side: "w" | "b") => (g ? (side === "w" ? g.white.name : g.black.name) : (state.seats[side]?.name ?? t("Waiting…")));
  const taken = capturedBy(pending ?? g?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const running = (side: "w" | "b") => !!g && !g.result && !pending && g.turn === side && g.moves.length > 0;
  const clock = (side: "w" | "b") => (g?.clock ? <Clock ms={g.clock[side]} running={running(side)} at={receivedAt.current} serverNow={serverNow} /> : null);
  const drawOfferedToMe = g && me && g.drawOfferBy && g.drawOfferBy !== me;
  const watching = state.members.filter((m) => m.online && m.id !== g?.white.id && m.id !== g?.black.id);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-2">
        <PlayerStrip name={seatName(top)} color={top} active={!!g && !g.result && g.turn === top} captured={taken[top]}>
          {clock(top)}
        </PlayerStrip>
        <Board
          fen={pending ?? g?.fen ?? "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
          orientation={orientation}
          canMove={g && !g.result && !pending && me ? me : null}
          onMove={play}
          lastMove={g?.lastMove}
        />
        <PlayerStrip name={seatName(bottom)} color={bottom} active={!!g && !g.result && g.turn === bottom} captured={taken[bottom]}>
          {clock(bottom)}
        </PlayerStrip>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-muted uppercase">{t("Room code")}</p>
              <p className="font-mono text-3xl font-extrabold tracking-[0.25em]">{code}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t("Copied") : t("Copy link")}
            </Button>
          </div>

          {!g && <p className="mt-4 rounded-2xl bg-surface-muted p-3 text-sm">{t("Waiting for a second player. Send them the code or the link.")}</p>}

          {g?.result && (
            <div className="mt-4 rounded-2xl bg-primary/10 p-4">
              <p className="text-lg font-extrabold">{resultText(g.result, g.white.name, g.black.name)}</p>
              {me && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => act("chess:rematch")} disabled={!!user && state.rematch.includes(user.id)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> {user && state.rematch.includes(user.id) ? t("Waiting for the other player…") : t("Rematch")}
                  </Button>
                  <Link href="/arena/chess" className={buttonClasses("secondary", "sm")}>
                    {t("Back to chess")}
                  </Link>
                </div>
              )}
            </div>
          )}

          {drawOfferedToMe && !g?.result && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-amber-500/12 p-3">
              <p className="flex-1 text-sm font-semibold">{t("{name} offers a draw", { name: g!.drawOfferBy === "w" ? g!.white.name : g!.black.name })}</p>
              <Button size="sm" variant="primary" onClick={() => act("chess:draw")}>
                {t("Accept")}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => act("chess:decline")}>
                {t("Decline")}
              </Button>
            </div>
          )}

          {g && !g.result && me && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => act("chess:draw")} disabled={g.drawOfferBy === me}>
                <Handshake className="h-4 w-4" aria-hidden="true" /> {g.drawOfferBy === me ? t("Draw offered") : t("Offer a draw")}
              </Button>
              <Button size="sm" variant="secondary" onClick={resign}>
                <Flag className="h-4 w-4" aria-hidden="true" /> {t("Resign")}
              </Button>
            </div>
          )}
          {g && !me && <p className="mt-3 text-sm text-muted">{t("You're watching this game.")}</p>}
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          )}
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-bold">{t("Moves")}</h3>
          <MoveList moves={g?.moves ?? []} />
          {watching.length > 0 && <p className="mt-3 text-xs text-muted">{t("Watching: {names}", { names: watching.map((m) => m.name).join(", ") })}</p>}
        </Card>
      </div>
    </div>
  );

  function mySide(s: ChessRoomState) {
    if (!user || !s.chess) return null;
    return s.chess.white.id === user.id ? "w" : s.chess.black.id === user.id ? "b" : null;
  }
  function winnerSide(s: ChessRoomState) {
    return s.chess?.result?.result === "1-0" ? "w" : s.chess?.result?.result === "0-1" ? "b" : null;
  }
}
