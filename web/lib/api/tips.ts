import { ApiError, apiFetch } from "./client";

export type TipSummary = { slug: string; title: string; summary: string; minutes: number };
export type Tip = TipSummary & { body: string[] };

export function getTips(): Promise<TipSummary[]> {
  return apiFetch<TipSummary[]>("/api/tips");
}

// null means "no such tip" (404). Other errors are thrown, so the error page shows.
export async function getTip(slug: string): Promise<Tip | null> {
  try {
    return await apiFetch<Tip>(`/api/tips/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
