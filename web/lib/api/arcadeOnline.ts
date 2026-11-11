// Arcade Online (Stage 14): Quiz Party. Playing goes over Socket.IO; these are the read-only lists.

import { apiFetch } from "./client";

export type CategoryId = "mixed" | "general" | "science" | "music" | "screen" | "food";
export type OpenRoom = { code: string; host: string; players: number; max: number; phase: "lobby" | "question" | "reveal" | "final"; category: string };
export type BoardRow = { name: string; games: number; wins: number; points: number; best: number; me: boolean };
export type QuizPlayer = { id: string; name: string; score: number; correct: number; connected: boolean; answered: boolean };
export type QuizState = {
  code: string;
  hostId: string;
  category: CategoryId;
  phase: "lobby" | "question" | "reveal" | "final";
  serverNow: number;
  round: number;
  rounds: number;
  players: QuizPlayer[];
  question?: { text: string; choices: string[]; category: string; endsAt: number; ms: number };
  reveal?: { answer: number; results: Record<string, { choice: number; gained: number; ms: number }> };
};
export type Ack = { ok: boolean; code?: string; error?: string };

export const getRooms = () => apiFetch<OpenRoom[]>("/api/arcade-online/rooms");
export const getQuizBoard = (period: "week" | "all") => apiFetch<BoardRow[]>(`/api/arcade-online/leaderboard?period=${period}`);
export const getCategories = () => apiFetch<{ id: CategoryId; label: string; questions: number }[]>("/api/arcade-online/categories");
