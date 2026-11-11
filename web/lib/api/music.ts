// Music: songs embedded from SoundCloud / YouTube (Stage 7).

import { apiFetch } from "./client";
import { clientId } from "./clientId";

export type Genre = "drill" | "remix" | "pop" | "lofi";
export type Period = "week" | "month" | "all";

export type Song = {
  id: number;
  provider: "soundcloud" | "youtube";
  url: string;
  embedUrl: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  genre: Genre;
  plays: number; // in the chosen period
  likes: number; // all time
  score: number;
  liked: boolean;
};

const who = () => ({ "X-Client-Id": clientId() });

export function getCharts(period: Period, genre: Genre | "all"): Promise<Song[]> {
  return apiFetch<Song[]>(`/api/songs?period=${period}&genre=${genre}`, { headers: who() });
}

export function addSong(url: string, genre: Genre): Promise<Song> {
  return apiFetch<Song>("/api/songs", { method: "POST", headers: who(), body: JSON.stringify({ url, genre }), timeoutMs: 12000 });
}

export function countPlay(id: number): Promise<{ counted: boolean }> {
  return apiFetch(`/api/songs/${id}/play`, { method: "POST", headers: who() });
}

export function setLike(id: number, like: boolean): Promise<{ liked: boolean; likes: number }> {
  return apiFetch(`/api/songs/${id}/like`, { method: like ? "PUT" : "DELETE", headers: who() });
}
