"use client";

// Stage 22: the chess board. Tap a piece, then tap where it goes, or drag it there. Legal moves come from
// chess.js (the same rules the game server uses), so you only ever send moves that are allowed.

import { Chess, type Square } from "chess.js";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { tx } from "@/lib/i18n/core";
import { useT } from "@/lib/i18n/I18nProvider";
import { Piece, type Color, type PieceType } from "./pieces";

export type MoveInput = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

type Props = {
  fen: string;
  orientation: Color;
  /** Whose pieces you may move now (null: just watching, or not your turn) */
  canMove: Color | null;
  onMove?: (m: MoveInput) => void;
  lastMove?: { from: string; to: string } | null;
  className?: string;
};

const FILES = "abcdefgh";
const PROMOTIONS: ("q" | "r" | "b" | "n")[] = ["q", "r", "b", "n"];

export function Board({ fen, orientation, canMove, onMove, lastMove, className }: Props) {
  const t = useT();
  const chess = useMemo(() => new Chess(fen), [fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [drag, setDrag] = useState<{ from: Square; x: number; y: number; left: number; top: number; cell: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // A new position (a move was played): forget the selection
  const [shownFen, setShownFen] = useState(fen);
  if (shownFen !== fen) {
    setShownFen(fen);
    setSelected(null);
    setPromotion(null);
  }

  const targets = useMemo(() => {
    if (!selected) return new Map<string, { capture: boolean; promotion: boolean }>();
    return new Map(chess.moves({ square: selected, verbose: true }).map((m) => [m.to, { capture: !!m.captured, promotion: !!m.promotion }]));
  }, [chess, selected]);

  const turn = chess.turn();
  const mine = (sq: Square) => {
    const p = chess.get(sq);
    return !!p && p.color === canMove && turn === canMove;
  };
  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    for (const row of chess.board()) for (const p of row) if (p && p.type === "k" && p.color === turn) return p.square;
    return null;
  }, [chess, turn]);

  const tryMove = (from: Square, to: Square) => {
    const target = new Map(chess.moves({ square: from, verbose: true }).map((m) => [m.to, m]));
    const move = target.get(to);
    if (!move) return false;
    if (move.promotion) {
      setPromotion({ from, to });
      return true;
    }
    setSelected(null);
    onMove?.({ from, to });
    return true;
  };

  const squareAt = (x: number, y: number): Square | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const col = Math.floor(((x - r.left) / r.width) * 8);
    const row = Math.floor(((y - r.top) / r.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = orientation === "w" ? col : 7 - col;
    const rank = orientation === "w" ? 8 - row : row + 1;
    return `${FILES[file]}${rank}` as Square;
  };

  const down = (e: ReactPointerEvent) => {
    if (promotion) return;
    const sq = squareAt(e.clientX, e.clientY);
    if (!sq) return;
    if (selected && targets.has(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (mine(sq)) {
      setSelected(sq);
      const r = boardRef.current!.getBoundingClientRect();
      setDrag({ from: sq, x: e.clientX, y: e.clientY, left: r.left, top: r.top, cell: r.width / 8 });
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else setSelected(null);
  };
  const move = (e: ReactPointerEvent) => {
    if (drag) setDrag({ ...drag, x: e.clientX, y: e.clientY });
  };
  const up = (e: ReactPointerEvent) => {
    if (!drag) return;
    const sq = squareAt(e.clientX, e.clientY);
    setDrag(null);
    if (sq && sq !== drag.from) tryMove(drag.from, sq);
  };

  const rows = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const cols = orientation === "w" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <div className={cn("relative aspect-square w-full touch-none select-none", className)}>
      <div
        ref={boardRef}
        role="grid"
        aria-label={t("Chess board")}
        className="grid h-full w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-2xl shadow-card ring-1 ring-black/10"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => setDrag(null)}
      >
        {rows.map((rank, ri) =>
          cols.map((file, ci) => {
            const sq = `${FILES[file]}${rank}` as Square;
            const p = chess.get(sq);
            const light = (file + rank) % 2 === 1;
            const target = targets.get(sq);
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            return (
              <div
                key={sq}
                role="gridcell"
                aria-label={`${sq}${p ? ` ${p.color === "w" ? t("white") : t("black")} ${t(PIECE_NAME_TEXT[p.type])}` : ""}`}
                data-square={sq}
                className={cn("relative", light ? "bg-[#efe3cc]" : "bg-[#9a7b62]", mine(sq) && "cursor-grab")}
              >
                {isLast && <span className="absolute inset-0 bg-amber-300/45" />}
                {selected === sq && <span className="absolute inset-0 bg-sky-400/45" />}
                {checkSquare === sq && <span className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.85)_0%,rgba(239,68,68,0.35)_45%,transparent_70%)]" />}
                {ci === 0 && <span className={cn("absolute top-0.5 left-1 text-[10px] font-bold", light ? "text-[#9a7b62]" : "text-[#efe3cc]")}>{rank}</span>}
                {ri === 7 && <span className={cn("absolute right-1 bottom-0 text-[10px] font-bold", light ? "text-[#9a7b62]" : "text-[#efe3cc]")}>{FILES[file]}</span>}
                {p && <Piece type={p.type as PieceType} color={p.color} className={cn("absolute inset-[6%] h-[88%] w-[88%]", drag?.from === sq && "opacity-30")} />}
                {target &&
                  (target.capture ? (
                    <span className="absolute inset-[4%] rounded-full border-[5px] border-black/25" />
                  ) : (
                    <span className="absolute top-1/2 left-1/2 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/22" />
                  ))}
              </div>
            );
          }),
        )}
      </div>

      {drag &&
        (() => {
          const p = chess.get(drag.from);
          if (!p) return null;
          const size = drag.cell * 1.1;
          return (
            <div className="pointer-events-none absolute z-10" style={{ left: drag.x - drag.left - size / 2, top: drag.y - drag.top - size * 0.55, width: size, height: size }}>
              <Piece type={p.type as PieceType} color={p.color} className="h-full w-full" />
            </div>
          );
        })()}

      {promotion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-black/40">
          <div role="dialog" aria-label={t("Promote to")} className="flex gap-2 rounded-2xl bg-surface p-3 shadow-card">
            {PROMOTIONS.map((type) => (
              <button
                key={type}
                type="button"
                aria-label={t(PIECE_NAME_TEXT[type])}
                className="h-16 w-16 cursor-pointer rounded-xl border border-border bg-[#efe3cc] p-1 hover:ring-2 hover:ring-primary"
                onClick={() => {
                  const { from, to } = promotion;
                  setPromotion(null);
                  setSelected(null);
                  onMove?.({ from, to, promotion: type });
                }}
              >
                <Piece type={type} color={turn} className="h-full w-full" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PIECE_NAME_TEXT: Record<PieceType, string> = { p: tx("pawn"), n: tx("knight"), b: tx("bishop"), r: tx("rook"), q: tx("queen"), k: tx("king") };
