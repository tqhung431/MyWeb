// Music: song files stored and streamed by Nook itself (Stage 8).

import { tNow } from "@/lib/i18n/core";
import { ApiError, apiFetch } from "./client";
import { clientId } from "./clientId";

export type Genre = "drill" | "remix" | "pop" | "lofi";
export type Period = "week" | "month" | "all";

export type Song = {
  id: number;
  title: string;
  artist: string;
  genre: Genre;
  durationSec: number | null;
  license: string;
  licenseUrl: string | null;
  credit: string | null;
  sourceUrl: string | null;
  audioUrl: string;
  artworkUrl: string | null;
};

export type ChartSong = Song & { plays: number; likes: number; score: number; liked: boolean; mine: boolean };
export type UploadedSong = Song & { detectedGenre: Genre; starterPack: boolean };

const who = () => ({ "X-Client-Id": clientId() });

// Stage 18 fix: songs come in pages (the list used to stop at 50), and can be searched by title or artist
export const CHART_PAGE = 100;
export function getCharts(period: Period, genre: Genre | "all", opts: { q?: string; offset?: number; limit?: number } = {}): Promise<ChartSong[]> {
  const params = new URLSearchParams({ period, genre, limit: String(opts.limit ?? CHART_PAGE), offset: String(opts.offset ?? 0) });
  if (opts.q?.trim()) params.set("q", opts.q.trim());
  return apiFetch<ChartSong[]>(`/api/songs?${params}`, { headers: who() });
}

export type UploadFields = { license: string; licenseUrl?: string; credit?: string; sourceUrl?: string; genre?: Genre | "auto" };

// XMLHttpRequest instead of fetch: it can report upload progress (fetch can't, yet).
export function uploadSong(file: File, fields: UploadFields, onProgress: (fraction: number) => void): Promise<UploadedSong> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("rights", "yes");
    for (const [k, v] of Object.entries(fields)) if (v) form.set(k, v);
    form.set("file", file); // last: the server reads the fields first
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/songs");
    xhr.setRequestHeader("X-Client-Id", clientId());
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const body = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return {};
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new ApiError(xhr.status, body.error ?? `Upload failed (${xhr.status})`, body.details));
    };
    xhr.onerror = () => reject(new ApiError(0, tNow("Can't reach Nook. Check your connection.")));
    xhr.send(form);
  });
}

// Stage 12: the biggest file Nook accepts, so the page can say so before uploading anything.
export function getUploadLimits(): Promise<{ maxMb: number; perHour: number }> {
  return apiFetch("/api/songs/upload-limits");
}

export function updateSong(id: number, changes: Partial<Pick<Song, "genre" | "title" | "artist">>): Promise<Song> {
  return apiFetch<Song>(`/api/songs/${id}`, { method: "PATCH", headers: who(), body: JSON.stringify(changes) });
}

export function deleteSong(id: number): Promise<void> {
  return apiFetch<void>(`/api/songs/${id}`, { method: "DELETE", headers: who() });
}

export function countPlay(id: number): Promise<{ counted: boolean }> {
  return apiFetch(`/api/songs/${id}/play`, { method: "POST", headers: who() });
}

export function setLike(id: number, like: boolean): Promise<{ liked: boolean; likes: number }> {
  return apiFetch(`/api/songs/${id}/like`, { method: like ? "PUT" : "DELETE", headers: who() });
}
