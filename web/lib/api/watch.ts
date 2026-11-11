// WatchList (Stage 12): TV shows (TVmaze) and anime (Jikan), your list, what others on Nook watch.

import { apiFetch } from "./client";
import { clientId } from "./clientId";

export type Source = "tv" | "anime";
export type Status = "want" | "watching" | "done" | "dropped";
export type Found = {
  source: Source;
  externalId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  kind: string;
  imageUrl: string | null;
  summary: string;
  genres: string[];
  rating: number | null;
  episodes: number | null;
  url: string | null;
  mine: { status: Status; titleId: number } | null;
};
export type Entry = {
  titleId: number;
  source: Source;
  externalId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  kind: string;
  imageUrl: string | null;
  genres: string[];
  episodes: number | null;
  status: Status;
  stars: number | null;
  note: string;
  episodesSeen: number | null;
  updatedAt: string;
};
export type Popular = {
  popular: {
    titleId: number;
    title: string;
    kind: string;
    year: number | null;
    imageUrl: string | null;
    people: number;
    watching: number;
    avgStars: number | null;
    names: string[];
  }[];
  latest: { name: string; status: Status; stars: number | null; updatedAt: string; titleId: number; title: string; imageUrl: string | null }[];
};
export type TitleDetail = {
  title: Omit<Found, "mine"> & { id: number };
  people: { name: string; status: Status; stars: number | null; note: string; updatedAt: string }[];
  mine: { status: Status; stars: number | null; note: string } | null;
};

export const STATUS_LABEL: Record<Status, string> = { want: "Want to watch", watching: "Watching", done: "Watched", dropped: "Dropped" };

export const searchTitles = (q: string, type: "all" | Source) =>
  apiFetch<{ results: Found[]; unavailable: Source[] }>(`/api/watch/search?q=${encodeURIComponent(q)}&type=${type}`, {
    headers: { "X-Client-Id": clientId() },
    timeoutMs: 20_000,
  });
export const getList = () => apiFetch<Entry[]>("/api/watch/list");
export const saveEntry = (
  source: Source,
  externalId: string,
  changes: { status: Status; stars?: number | null; note?: string; episodesSeen?: number | null },
) => apiFetch<Entry>(`/api/watch/list/${source}/${externalId}`, { method: "PUT", body: JSON.stringify(changes), timeoutMs: 20_000 });
export const removeEntry = (titleId: number) => apiFetch<void>(`/api/watch/list/${titleId}`, { method: "DELETE" });
export const getPopular = () => apiFetch<Popular>("/api/watch/popular");
export const getTitle = (id: number) => apiFetch<TitleDetail>(`/api/watch/titles/${id}`);
