// Stage 27: the Admin page (the admin only), reports and the banner (everyone).
import { apiFetch } from "./client";

export type AdminPerson = { id: string; name: string; createdAt: string; lastSeenAt: string; hasPin: boolean; pausedUntil: string | null; devices: number };
export type Report = {
  id: number;
  kind: "post" | "comment" | "message" | "dm";
  targetId: number;
  authorName: string;
  excerpt: string;
  hasPicture: boolean;
  where: string;
  reason: string;
  status: "open" | "kept" | "deleted";
  createdAt: string;
  reporter: string;
};
export type AdminScore = { id: number; game: string; score: number; name: string; createdAt: string };
export type Storage = { songs: { bytes: number; files: number }; pictures: { bytes: number; files: number }; disk: { free: number; total: number } | null };
export type Health = {
  database: string;
  valkey: string;
  gameServer: string;
  ai: string;
  disk: { free: number; total: number } | null;
};
export type LogLine = { id: number; at: string; byName: string; action: string; detail: string };

const json = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const getPeople = () => apiFetch<AdminPerson[]>("/api/admin/people");
export const renamePerson = (id: string, name: string) => apiFetch<{ name: string }>(`/api/admin/people/${id}`, json("PATCH", { name }));
export const claimCode = (id: string) => apiFetch<{ code: string; expiresAt: string }>(`/api/admin/people/${id}/claim-code`, json("POST"));
export const signOutPerson = (id: string) => apiFetch<{ signedOut: number }>(`/api/admin/people/${id}/sign-out`, json("POST"));
export const pausePerson = (id: string, days: 0 | 1 | 7 | 3650) => apiFetch<{ pausedUntil: string | null }>(`/api/admin/people/${id}/pause`, json("POST", { days }));
export const deletePerson = (id: string, confirm: string) => apiFetch<void>(`/api/admin/people/${id}`, json("DELETE", { confirm }));
export const lockGroup = (slug: string, locked: boolean) => apiFetch<{ locked: boolean }>(`/api/admin/groups/${slug}/lock`, json("POST", { locked }));
export const getReports = (status: "open" | "kept" | "deleted" = "open") => apiFetch<Report[]>(`/api/admin/reports?status=${status}`);
export const settleReport = (id: number, action: "keep" | "delete") => apiFetch<{ status: string }>(`/api/admin/reports/${id}`, json("POST", { action }));
export const deleteSongAsAdmin = (id: number) => apiFetch<void>(`/api/admin/songs/${id}`, json("DELETE"));
export const getScores = () => apiFetch<AdminScore[]>("/api/admin/scores");
export const deleteScore = (id: number) => apiFetch<void>(`/api/admin/scores/${id}`, json("DELETE"));
export const setBanner = (text: string) => apiFetch<{ text: string | null }>("/api/admin/banner", json("PUT", { text }));
export const getStorage = () => apiFetch<Storage>("/api/admin/storage");
export const runCleanup = () => apiFetch<{ queued: boolean }>("/api/admin/cleanup", json("POST"));
export const getLog = () => apiFetch<LogLine[]>("/api/admin/log");
// Stage 28: who came in, when, how, on what kind of device
export type SignIn = { id: number; name: string; how: "new" | "pin" | "code" | "claim"; userAgent: string | null; at: string };
export const getSignIns = () => apiFetch<SignIn[]>("/api/admin/sign-ins");
export const getHealth = () => apiFetch<Health>("/api/admin/health");

// For everyone
export const report = (kind: Report["kind"], id: number, reason = "") => apiFetch<{ reported: boolean }>("/api/reports", json("POST", { kind, id, reason }));
export const getBanner = () => apiFetch<{ text: string | null }>("/api/banner");
