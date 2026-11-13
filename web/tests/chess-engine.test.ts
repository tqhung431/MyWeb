// Stage 22: Nook's chess computer: its move generator matches the standard "perft" counts, it finds the
// obvious things, and it never plays an illegal move (chess.js checks every one).
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { bestMove, evaluate, perft, rng } from "@/features/arena/chess/engine";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// "Kiwipete": a famous test position full of castling, en passant and promotions
const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

describe("chess engine", () => {
  it("generates exactly the right moves (perft)", () => {
    expect(perft(START, 1)).toBe(20);
    expect(perft(START, 3)).toBe(8902);
    expect(perft(KIWIPETE, 1)).toBe(48);
    expect(perft(KIWIPETE, 2)).toBe(2039);
    expect(perft(KIWIPETE, 3)).toBe(97862);
    expect(perft("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1", 4)).toBe(43238); // en passant and pins
    expect(perft("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1", 3)).toBe(9467); // promotions
  });

  it("scores the starting position as even, and an extra queen as winning", () => {
    expect(evaluate(START)).toBe(0);
    expect(evaluate("4k3/8/8/8/8/8/8/3QK3 w - - 0 1")).toBeGreaterThan(800);
  });

  it("finds mate in one at every level", () => {
    const fen = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4"; // Qxf7#
    for (const level of [1, 2, 3, 4] as const) expect(bestMove(fen, level, rng(level))).toEqual({ from: "h5", to: "f7" });
  });

  it("takes a free queen from level 2 up, and promotes a pawn", () => {
    for (const level of [2, 3, 4] as const) expect(bestMove("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1", level, rng(7))).toMatchObject({ from: "d1", to: "d5" });
    expect(bestMove("8/P6k/8/8/8/8/8/K7 w - - 0 1", 3, rng(1))).toEqual({ from: "a7", to: "a8", promotion: "q" });
  });

  it("plays legal moves through a whole game, and has nothing to play when mated", () => {
    const game = new Chess();
    const random = rng(42);
    for (let i = 0; i < 60 && !game.isGameOver(); i++) game.move(bestMove(game.fen(), i % 2 ? 1 : 3, random)!); // throws if illegal
    expect(game.history().length).toBeGreaterThan(10);
    expect(bestMove("7k/5QQ1/8/8/8/8/8/K7 b - - 0 1", 3)).toBeNull();
  });

  it("thinks fast enough for a phone (level 4 in the middle game)", () => {
    const t = performance.now();
    bestMove("r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", 4, rng(3));
    expect(performance.now() - t).toBeLessThan(8000); // usually 1–2 s here; a phone is slower but it runs in a worker
  });
});
