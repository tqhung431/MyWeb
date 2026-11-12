// Stage 22: one live chess game, as plain data + functions. No network code here (rooms.ts and server.ts
// do that), so every rule can be tested with a fake clock, like Quiz Party's game.ts.
//
// The rules of chess come from chess.js (BSD licence): legal moves, check, mate, stalemate, draws.
// This file adds what a live game needs: who is white/black, clocks, resign, draw offers, the result.

import { Chess } from "chess.js";

export type Side = "w" | "b";
export type TimeControl = "none" | "5+0" | "10+0" | "15+10";
export const TIME_CONTROLS: TimeControl[] = ["none", "5+0", "10+0", "15+10"];
export type Player = { id: string; name: string };
export type Result = "1-0" | "0-1" | "1/2-1/2";
export type Reason = "checkmate" | "resign" | "time" | "stalemate" | "repetition" | "insufficient" | "fifty-moves" | "agreement" | "abandoned";

export type ChessGame = {
  chess: Chess;
  white: Player;
  black: Player;
  timeControl: TimeControl;
  clock: { w: number; b: number } | null; // ms left; null = no clock
  turnStartedAt: number; // when the side to move started thinking
  drawOfferBy: Side | null;
  result: { result: Result; reason: Reason } | null;
  lastMove: { from: string; to: string } | null;
};

export function parseTimeControl(tc: TimeControl): { base: number; increment: number } | null {
  if (tc === "none") return null;
  const [m, s] = tc.split("+").map(Number);
  return { base: m * 60_000, increment: s * 1000 };
}

export function newChessGame(white: Player, black: Player, timeControl: TimeControl, now: number): ChessGame {
  const tc = parseTimeControl(timeControl);
  const chess = new Chess();
  chess.header("White", white.name, "Black", black.name, "Site", "Nook", "Date", new Date(now).toISOString().slice(0, 10).replace(/-/g, "."));
  return {
    chess,
    white,
    black,
    timeControl,
    clock: tc ? { w: tc.base, b: tc.base } : null,
    turnStartedAt: now,
    drawOfferBy: null,
    result: null,
    lastMove: null,
  };
}

export function sideOf(g: ChessGame, playerId: string): Side | null {
  if (g.white.id === playerId) return "w";
  if (g.black.id === playerId) return "b";
  return null;
}

const other = (s: Side): Side => (s === "w" ? "b" : "w");
const winFor = (s: Side): Result => (s === "w" ? "1-0" : "0-1");

// Time left for each side right now (the side to move is losing time)
export function clocksAt(g: ChessGame, now: number): { w: number; b: number } | null {
  if (!g.clock) return null;
  if (g.result) return { ...g.clock };
  const turn = g.chess.turn();
  const spent = now - g.turnStartedAt;
  return { ...g.clock, [turn]: Math.max(0, g.clock[turn] - spent) };
}

function finish(g: ChessGame, result: Result, reason: Reason) {
  g.result = { result, reason };
  g.chess.header("Result", result);
}

// After every move: mate, stalemate and the automatic draws
function checkEnd(g: ChessGame) {
  const c = g.chess;
  if (c.isCheckmate()) finish(g, winFor(other(c.turn())), "checkmate");
  else if (c.isStalemate()) finish(g, "1/2-1/2", "stalemate");
  else if (c.isInsufficientMaterial()) finish(g, "1/2-1/2", "insufficient");
  else if (c.isThreefoldRepetition()) finish(g, "1/2-1/2", "repetition");
  else if (c.isDrawByFiftyMoves()) finish(g, "1/2-1/2", "fifty-moves");
}

export type MoveInput = { from: string; to: string; promotion?: "q" | "r" | "b" | "n" };

// A player's move. Returns an error message, or null when it was played.
export function playMove(g: ChessGame, playerId: string, move: MoveInput, now: number): string | null {
  if (g.result) return "The game is over";
  const side = sideOf(g, playerId);
  if (!side) return "You're watching this game";
  if (g.chess.turn() !== side) return "It's not your turn";
  if (flagIfOut(g, now)) return "Out of time";
  let played;
  try {
    played = g.chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
  } catch {
    return "That move isn't allowed";
  }
  if (g.clock) {
    const tc = parseTimeControl(g.timeControl)!;
    g.clock[side] = Math.max(0, g.clock[side] - (now - g.turnStartedAt)) + tc.increment;
  }
  g.turnStartedAt = now;
  g.lastMove = { from: played.from, to: played.to };
  if (g.drawOfferBy && g.drawOfferBy !== side) g.drawOfferBy = null; // moving declines a draw offer
  checkEnd(g);
  return null;
}

// Called often by the server: the side to move ran out of time
export function flagIfOut(g: ChessGame, now: number): boolean {
  if (g.result || !g.clock) return false;
  const left = clocksAt(g, now)!;
  const turn = g.chess.turn();
  if (left[turn] > 0) return false;
  g.clock[turn] = 0;
  // Out of time, but the other side can't possibly mate: a draw (the usual rule)
  const c = g.chess;
  const material = c
    .board()
    .flat()
    .filter((p) => p && p.color === other(turn) && p.type !== "k");
  const canMate = material.some((p) => p!.type !== "b" && p!.type !== "n") || material.length >= 2;
  if (canMate) finish(g, winFor(other(turn)), "time");
  else finish(g, "1/2-1/2", "insufficient");
  return true;
}

export function resign(g: ChessGame, playerId: string): string | null {
  const side = sideOf(g, playerId);
  if (!side || g.result) return "Can't resign now";
  finish(g, winFor(other(side)), "resign");
  return null;
}

export function abandon(g: ChessGame, playerId: string) {
  const side = sideOf(g, playerId);
  if (side && !g.result) finish(g, winFor(other(side)), "abandoned");
}

// Offer a draw, or accept the other side's offer
export function offerDraw(g: ChessGame, playerId: string): "offered" | "agreed" | string {
  const side = sideOf(g, playerId);
  if (!side || g.result) return "Can't offer a draw now";
  if (g.drawOfferBy === other(side)) {
    finish(g, "1/2-1/2", "agreement");
    return "agreed";
  }
  g.drawOfferBy = side;
  return "offered";
}

export function declineDraw(g: ChessGame, playerId: string) {
  const side = sideOf(g, playerId);
  if (side && g.drawOfferBy === other(side)) g.drawOfferBy = null;
}

// What every browser gets: no hidden information in chess, so one view for all
export function chessView(g: ChessGame, now: number) {
  return {
    fen: g.chess.fen(),
    pgn: g.chess.pgn(),
    moves: g.chess.history(),
    turn: g.chess.turn(),
    inCheck: g.chess.inCheck(),
    white: g.white,
    black: g.black,
    timeControl: g.timeControl,
    clock: clocksAt(g, now),
    serverNow: now,
    drawOfferBy: g.drawOfferBy,
    lastMove: g.lastMove,
    result: g.result,
  };
}
export type ChessView = ReturnType<typeof chessView>;

// Elo: the expected score from the rating gap, then move each rating by K × (actual − expected)
export function eloChange(a: number, b: number, scoreA: 0 | 0.5 | 1, k = 32): number {
  const expected = 1 / (1 + 10 ** ((b - a) / 400));
  return Math.round(k * (scoreA - expected));
}
