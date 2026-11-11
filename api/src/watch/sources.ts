// WatchList's two free sources (Stage 12), turned into ONE shape so the rest of Nook doesn't care where
// a title came from:
//   TV shows: TVmaze  https://www.tvmaze.com/api   (no key; ~20 calls per 10 s)
//   Anime:    Jikan   https://jikan.moe            (no key; MyAnimeList data; 3 calls a second)
//
// Answers are kept in Valkey for a day, so typing "friends" twice costs one call, and their limits are respected.

import { config } from "../config.js";
import { HttpError } from "../middleware/errors.js";
import { cached } from "../valkey/cache.js";

export type Source = "tv" | "anime";

export type Title = {
  source: Source;
  externalId: string;
  title: string;
  originalTitle: string | null;
  year: number | null;
  kind: string;
  imageUrl: string | null;
  summary: string;
  genres: string[];
  rating: number | null; // 0–100 (8.5/10 → 85)
  episodes: number | null;
  url: string | null;
};

const DAY = 24 * 60 * 60;
export class SourceDown extends Error {}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Nook (a self-hosted home app)", Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw new SourceDown(`Can't reach ${new URL(url).host}`);
  }
  if (res.status === 404) throw new HttpError(404, "Title not found");
  if (!res.ok) throw new SourceDown(`${new URL(url).host} answered ${res.status}`);
  return (await res.json()) as T;
}

// "<p><b>Friends</b> is…</p>" → "Friends is…"
export function plainText(html: string | null | undefined, max = 600): string {
  const text = (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\[Written by MAL Rewrite\]/g, "")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const score = (n: number | null | undefined) => (typeof n === "number" ? Math.round(n * 10) : null);

// --- TVmaze ---------------------------------------------------------------------------------

type TvShow = {
  id: number;
  name: string;
  premiered: string | null;
  genres: string[];
  image: { medium: string; original: string } | null;
  summary: string | null;
  rating: { average: number | null };
  url: string;
  language: string | null;
};

export function fromTvmaze(s: TvShow): Title {
  return {
    source: "tv",
    externalId: String(s.id),
    title: s.name,
    originalTitle: null,
    year: s.premiered ? Number(s.premiered.slice(0, 4)) : null,
    kind: "TV show",
    imageUrl: s.image?.medium ?? null,
    summary: plainText(s.summary),
    genres: s.genres ?? [],
    rating: score(s.rating?.average),
    episodes: null,
    url: s.url ?? null,
  };
}

// --- Jikan (anime) ---------------------------------------------------------------------------

type Anime = {
  mal_id: number;
  url: string;
  title: string;
  title_english: string | null;
  type: string | null;
  episodes: number | null;
  year: number | null;
  aired?: { from: string | null };
  score: number | null;
  synopsis: string | null;
  genres: { name: string }[];
  images: { jpg?: { image_url?: string; large_image_url?: string }; webp?: { image_url?: string } };
};

const ANIME_KIND: Record<string, string> = { TV: "Anime series", Movie: "Anime movie", OVA: "Anime (OVA)", ONA: "Anime (web)", Special: "Anime special" };

export function fromJikan(a: Anime): Title {
  return {
    source: "anime",
    externalId: String(a.mal_id),
    title: a.title_english || a.title,
    originalTitle: a.title_english && a.title_english !== a.title ? a.title : null,
    year: a.year ?? (a.aired?.from ? Number(a.aired.from.slice(0, 4)) : null),
    kind: ANIME_KIND[a.type ?? ""] ?? "Anime",
    imageUrl: a.images?.jpg?.image_url ?? a.images?.webp?.image_url ?? null,
    summary: plainText(a.synopsis),
    genres: (a.genres ?? []).map((g) => g.name),
    rating: score(a.score),
    episodes: a.episodes ?? null,
    url: a.url ?? null,
  };
}

// --- search and look-up -----------------------------------------------------------------------

async function searchOne(source: Source, q: string): Promise<Title[]> {
  const key = `watch:search:${source}:${q.toLowerCase()}`;
  const { value } = await cached(key, DAY, async () => {
    if (source === "tv") {
      const rows = await getJson<{ show: TvShow }[]>(`${config.TVMAZE_URL}/search/shows?q=${encodeURIComponent(q)}`);
      return rows.map((r) => fromTvmaze(r.show));
    }
    const res = await getJson<{ data: Anime[] }>(`${config.JIKAN_URL}/anime?q=${encodeURIComponent(q)}&limit=12&sfw=true&order_by=members&sort=desc`);
    return res.data.map(fromJikan);
  });
  return value;
}

// Both sources at once. One being down isn't an error: you get the other, and a note.
export async function search(q: string, sources: Source[]): Promise<{ results: Title[]; unavailable: Source[] }> {
  const settled = await Promise.allSettled(sources.map((s) => searchOne(s, q)));
  const unavailable = sources.filter((_, i) => settled[i].status === "rejected");
  const lists = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  // Interleave, so both kinds show near the top: tv1, anime1, tv2, anime2…
  const results: Title[] = [];
  for (let i = 0; i < Math.max(0, ...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) results.push(l[i]);
  return { results, unavailable };
}

export async function lookUp(source: Source, externalId: string): Promise<Title> {
  const { value } = await cached(`watch:title:${source}:${externalId}`, DAY, async () => {
    if (source === "tv") return fromTvmaze(await getJson<TvShow>(`${config.TVMAZE_URL}/shows/${encodeURIComponent(externalId)}`));
    return fromJikan((await getJson<{ data: Anime }>(`${config.JIKAN_URL}/anime/${encodeURIComponent(externalId)}`)).data);
  });
  return value;
}
