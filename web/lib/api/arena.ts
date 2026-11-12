// Stage 22: Nook Arena and Nook TV. Playing goes over the game server (features/arena/ArenaProvider);
// these are the plain web requests around it.

import { apiFetch } from "./client";

export type Person = { id: string; name: string };
export type TimeControl = "none" | "5+0" | "10+0" | "15+10";

export type ChessView = {
  fen: string;
  pgn: string;
  moves: string[];
  turn: "w" | "b";
  inCheck: boolean;
  white: Person;
  black: Person;
  timeControl: TimeControl;
  clock: { w: number; b: number } | null;
  serverNow: number;
  drawOfferBy: "w" | "b" | null;
  lastMove: { from: string; to: string } | null;
  result: { result: "1-0" | "0-1" | "1/2-1/2"; reason: string } | null;
};
export type ChessRoomState = {
  code: string;
  kind: "chess";
  members: (Person & { online: boolean })[];
  timeControl: TimeControl;
  seats: { w: Person | null; b: Person | null };
  chess: ChessView | null;
  rematch: string[];
};

export type ListenSong = { id: number; title: string; artist: string; durationSec: number | null; audioUrl: string; artworkUrl: string | null };
export type ListenView = {
  name: string;
  hostId: string;
  everyoneControls: boolean;
  serverNow: number;
  now: { key: number; song: ListenSong; addedBy: Person; startedAt: number; pausedAt: number | null } | null;
  queue: { key: number; song: ListenSong; addedBy: Person; votes: number; voted: boolean }[];
  skipVotes: number;
};
export type ListenRoomState = { code: string; kind: "listen"; members: (Person & { online: boolean })[]; listen: ListenView };

export type OpenChessRoom = { code: string; kind: "chess"; timeControl: TimeControl; white: string | null; black: string | null; status: "waiting" | "playing" | "over"; people: number };
export type OpenListenRoom = { code: string; kind: "listen"; name: string; people: number; playing: string | null };

export type ChessGameRow = {
  id: number;
  whiteName: string;
  blackName: string;
  mode: "live" | "nook";
  nookLevel: number | null;
  timeControl: string;
  result: "1-0" | "0-1" | "1/2-1/2";
  reason: string;
  endedAt: string;
};
export type ChessGameFull = ChessGameRow & { pgn: string; mine: boolean };
export type RatingRow = { rank: number; name: string; rating: number; games: number; wins: number; draws: number; losses: number; me: boolean };

export const getChessGames = (mine = false) => apiFetch<ChessGameRow[]>(`/api/chess/games${mine ? "?mine=1" : ""}`);
export const getChessGame = (id: number) => apiFetch<ChessGameFull>(`/api/chess/games/${id}`);
export const getChessBoard = () => apiFetch<RatingRow[]>("/api/chess/leaderboard");
export const saveNookGame = (body: { pgn: string; level: number; color: "w" | "b"; resigned?: boolean }) =>
  apiFetch<{ id: number; result: string; reason: string }>("/api/chess/nook", { method: "POST", body: JSON.stringify(body) });

// Admin and Nook TV
export type AdminStatus = { enabled: boolean; isAdmin: boolean };
export type TvVideo = { id: number; kind: "video" | "playlist"; youtubeId: string; title: string; shelf: string; position: number };

export const getAdmin = () => apiFetch<AdminStatus>("/api/admin");
export const becomeAdmin = (passcode: string) => apiFetch<AdminStatus>("/api/admin", { method: "POST", body: JSON.stringify({ passcode }) });
export const stopAdmin = () => apiFetch<AdminStatus>("/api/admin", { method: "DELETE" });
export const getTv = () => apiFetch<{ shelves: { name: string; videos: TvVideo[] }[] }>("/api/tv");
export const addTv = (body: { url: string; shelf: string }) => apiFetch<TvVideo>("/api/tv", { method: "POST", body: JSON.stringify(body), timeoutMs: 10_000 });
export const editTv = (id: number, body: Partial<Pick<TvVideo, "title" | "shelf" | "position">>) => apiFetch<TvVideo>(`/api/tv/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const removeTv = (id: number) => apiFetch<void>(`/api/tv/${id}`, { method: "DELETE" });
