// Nook Games (Stage 16): cloud saves. Only for people with a name; guests keep their save in the browser.

import { apiFetch } from "./client";

export type GameId = "van-lo" | "village"; // Stage 24: Giữ Làng solo saves
export type CloudSave = { game: GameId; version: number; summary: string; data: unknown; updatedAt: string };

export const getSave = (game: GameId) => apiFetch<CloudSave>(`/api/games/saves/${game}`);
export type Board = { path: string; level: number; kills: number };
export type BoardRow = Board & { rank: number; name: string; summary: string; me: boolean };

export const putSave = (game: GameId, body: { version: number; summary: string; data: unknown; board?: Board }) =>
  apiFetch<{ ok: true; updatedAt: string }>(`/api/games/saves/${game}`, { method: "PUT", body: JSON.stringify(body), timeoutMs: 10_000 });
export const deleteSave = (game: GameId) => apiFetch<void>(`/api/games/saves/${game}`, { method: "DELETE" });
// Stage 18: the highest cultivators on Nook
export const getLeaderboard = (game: GameId) => apiFetch<BoardRow[]>(`/api/games/leaderboard/${game}`);
