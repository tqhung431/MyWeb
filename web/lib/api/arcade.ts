// Mini Arcade high scores (Stage 10). The games run in the browser; the API keeps the scores.

import { apiFetch } from "./client";
import { clientId } from "./clientId";

export type GameId = "worm" | "pairs" | "bonk" | "pancakes" | "reflex" | "odd";
export type BoardPeriod = "week" | "all";
export type BoardRow = { rank: number; name: string; score: number; me: boolean };
export type Board = { game: GameId; period: BoardPeriod; top: BoardRow[]; best: number | null; rank: number | null };
export type SaveResult = { game: GameId; score: number; best: number; previousBest: number | null; newBest: boolean; rank: number };

const who = () => ({ "X-Client-Id": clientId() });

export function saveScore(game: GameId, score: number): Promise<SaveResult> {
  return apiFetch<SaveResult>("/api/arcade/scores", { method: "POST", headers: who(), body: JSON.stringify({ game, score }) });
}

export function getBoard(game: GameId, period: BoardPeriod): Promise<Board> {
  return apiFetch<Board>(`/api/arcade/scores/${game}?period=${period}`, { headers: who() });
}

export function getMyBests(): Promise<{ bests: Partial<Record<GameId, number>> }> {
  return apiFetch("/api/arcade/me", { headers: who() });
}
