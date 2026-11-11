// Nook Games (Stage 16): cloud saves. Only for people with a name; guests keep their save in the browser.

import { apiFetch } from "./client";

export type GameId = "van-lo";
export type CloudSave = { game: GameId; version: number; summary: string; data: unknown; updatedAt: string };

export const getSave = (game: GameId) => apiFetch<CloudSave>(`/api/games/saves/${game}`);
export const putSave = (game: GameId, body: { version: number; summary: string; data: unknown }) =>
  apiFetch<{ ok: true; updatedAt: string }>(`/api/games/saves/${game}`, { method: "PUT", body: JSON.stringify(body), timeoutMs: 10_000 });
export const deleteSave = (game: GameId) => apiFetch<void>(`/api/games/saves/${game}`, { method: "DELETE" });
