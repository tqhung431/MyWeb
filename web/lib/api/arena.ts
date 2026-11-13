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

// --- Ngõ Pháo (Stage 23) -----------------------------------------------------------------------
export type AlleyMap = "old-town" | "market" | "rooftops";
export type AlleyPower = "bomb" | "fire" | "speed" | "kick" | "shield";
export type AlleySeat = Person & { color: number; hat: number; ready: boolean };
export type AlleyLobby = { hostId: string | null; map: AlleyMap | "random"; bots: number; seats: AlleySeat[]; playing: boolean; away: string[] };
export type AlleyRoomState = { code: string; kind: "alley"; members: (Person & { online: boolean })[]; alley: AlleyLobby };
export type OpenAlleyRoom = { code: string; kind: "alley"; host: string | null; players: number; bots: number; map: string; status: "waiting" | "playing"; people: number };
export type AlleyPlayerView = {
  id: string;
  name: string;
  color: number;
  hat: number;
  bot: boolean;
  x: number;
  y: number;
  dir: 0 | 1 | 2 | 3 | 4;
  alive: boolean;
  ghost: boolean;
  shield: boolean;
  stunned: boolean;
  blink: boolean;
  bombs: number;
  fire: number;
  boots: number;
  kick: boolean;
  tinyIn: number;
  score: number;
};
export type AlleyStats = { crates: number; outs: number; selfOuts: number; powers: number; teases: number; wins: number };
export type AlleyEvent =
  | { t: "pop"; tx: number; ty: number; tiny: boolean }
  | { t: "crate"; tx: number; ty: number }
  | { t: "out"; id: string; by: string | null }
  | { t: "power"; id: string; power: AlleyPower; tx: number; ty: number }
  | { t: "shield"; id: string }
  | { t: "stun"; id: string }
  | { t: "kick"; id: string }
  | { t: "lion" }
  | { t: "ring"; k: number };
export type AlleyTick = {
  code: string;
  t: number;
  phase: "countdown" | "playing" | "roundEnd" | "matchEnd";
  phaseEndsAt: number;
  playStartedAt: number;
  round: number;
  map: AlleyMap;
  tiles: string;
  items: [number, AlleyPower][];
  players: AlleyPlayerView[];
  bombs: { id: number; tx: number; ty: number; slide: number; progress: number; tiny: boolean; left: number; mine: string[] }[];
  sparks: [number, number, number][];
  lion: { row: number; x: number; dir: 1 | -1 } | null;
  ringAt: number | null;
  rings: number;
  roundWinner: string | null;
  matchWinner: string | null;
  awards: { award: string; id: string; value: number }[];
  stats: Record<string, AlleyStats> | null;
  events: AlleyEvent[];
};
export type AlleyBoardRow = { rank: number; name: string; games: number; wins: number; me: boolean };
export const getAlleyBoard = () => apiFetch<AlleyBoardRow[]>("/api/alley/leaderboard");

// --- Giữ Làng (Stage 24) -----------------------------------------------------------------------
export type VillageLobbyState = { hostId: string | null; map: "riverside" | "terraces" | "festival"; endless: boolean; seats: Person[]; playing: boolean; speed: 1 | 2; paused: boolean };
export type VillageRoomState = { code: string; kind: "village"; members: (Person & { online: boolean })[]; village: VillageLobbyState };
export type OpenVillageRoom = { code: string; kind: "village"; host: string | null; players: number; map: string; status: "waiting" | "playing"; people: number };
export type VillageBoardRow = { rank: number; name: string; score: number; waves: number; me: boolean };
export const getVillageBoard = (map: string) => apiFetch<VillageBoardRow[]>(`/api/village/leaderboard?map=${map}`);
export const saveVillageScore = (body: { map: string; waves: number; rice: number; won: boolean; endless: boolean }) =>
  apiFetch<{ score: number }>("/api/village/scores", { method: "POST", body: JSON.stringify(body) });
