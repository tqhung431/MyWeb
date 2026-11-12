// Stage 22: "Nook", the chess computer you can play against, at 4 levels. It runs in a Web Worker
// (engine.worker.ts) so the page never freezes while it thinks.
//
// chess.js knows the rules but is built for clarity, not speed (a few thousand positions a second): too slow to
// look ahead. So the engine has its own small, fast board ("0x88": 128 squares, the right half unused, so
// "off the board" is a single bit test) and its own move generator. Tests check it against chess.js and against
// "perft" counts, the standard numbers every correct move generator must reproduce.
//
// How it thinks (the classic recipe, kept small):
//   - score a position: material (pawn 100, knight 320…) + a bonus for good squares (piece-square tables)
//   - look a few moves ahead (negamax with alpha-beta pruning: skip lines that can't change the choice)
//   - higher levels keep looking at captures at the end of a line ("quiescence"), so they don't stop mid-trade
//   - lower levels add random noise to the scores, so they make human-looking mistakes
// Pure functions with a seeded random number generator: tests give the same answer every time.

export type Level = 1 | 2 | 3 | 4;
export const LEVELS: { level: Level; depth: number; noise: number; quiescence: boolean; maxNodes: number }[] = [
  { level: 1, depth: 1, noise: 120, quiescence: false, maxNodes: 20_000 },
  { level: 2, depth: 2, noise: 40, quiescence: true, maxNodes: 60_000 },
  { level: 3, depth: 3, noise: 12, quiescence: true, maxNodes: 200_000 },
  { level: 4, depth: 4, noise: 0, quiescence: true, maxNodes: 600_000 },
];

// --- the board -------------------------------------------------------------------------------

// Pieces: 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king; +8 for black. 0 = empty.
const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6, BLACK = 8; // prettier-ignore
const LETTERS = ".pnbrqk";
// Square = row * 16 + file; row 0 is rank 8 (the order FEN uses)
const sqName = (sq: number) => "abcdefgh"[sq & 7] + (8 - (sq >> 4));
const sqOf = (name: string) => (8 - Number(name[1])) * 16 + (name.charCodeAt(0) - 97);

type Pos = {
  board: Int8Array; // 128
  white: boolean; // white to move
  castle: number; // 1 white short, 2 white long, 4 black short, 8 black long
  ep: number; // en passant target square, or -1
  kings: [number, number]; // white, black
};

export type EMove = { from: number; to: number; piece: number; captured: number; promo: number; flag: 0 | 1 | 2 | 3 }; // 1 ep, 2 castle, 3 double push
type Undo = { castle: number; ep: number; captured: number };

export function fromFen(fen: string): Pos {
  const [placement, side, castling, ep] = fen.split(" ");
  const board = new Int8Array(128);
  const kings: [number, number] = [0, 0];
  placement.split("/").forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        const type = LETTERS.indexOf(ch.toLowerCase());
        const black = ch === ch.toLowerCase();
        board[r * 16 + f] = type + (black ? BLACK : 0);
        if (type === K) kings[black ? 1 : 0] = r * 16 + f;
        f++;
      }
    }
  });
  let castle = 0;
  if (castling.includes("K")) castle |= 1;
  if (castling.includes("Q")) castle |= 2;
  if (castling.includes("k")) castle |= 4;
  if (castling.includes("q")) castle |= 8;
  return { board, white: side === "w", castle, ep: ep && ep !== "-" ? sqOf(ep) : -1, kings };
}

const KNIGHT = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING = [-17, -16, -15, -1, 1, 15, 16, 17];
const DIAG = [-17, -15, 15, 17];
const LINE = [-16, -1, 1, 16];

/** Is `sq` attacked by the side `byWhite`? */
function attacked(pos: Pos, sq: number, byWhite: boolean): boolean {
  const b = pos.board;
  const c = byWhite ? 0 : BLACK;
  // pawns: a white pawn attacks up the board (towards row 0), so it sits one row below
  const pawnRow = byWhite ? 16 : -16;
  for (const d of [pawnRow - 1, pawnRow + 1]) {
    const s = sq + d;
    if (!(s & 0x88) && b[s] === P + c) return true;
  }
  for (const d of KNIGHT) {
    const s = sq + d;
    if (!(s & 0x88) && b[s] === N + c) return true;
  }
  for (const d of KING) {
    const s = sq + d;
    if (!(s & 0x88) && b[s] === K + c) return true;
  }
  for (const d of DIAG) {
    for (let s = sq + d; !(s & 0x88); s += d) {
      if (b[s]) {
        if (b[s] === B + c || b[s] === Q + c) return true;
        break;
      }
    }
  }
  for (const d of LINE) {
    for (let s = sq + d; !(s & 0x88); s += d) {
      if (b[s]) {
        if (b[s] === R + c || b[s] === Q + c) return true;
        break;
      }
    }
  }
  return false;
}

const inCheck = (pos: Pos) => attacked(pos, pos.kings[pos.white ? 0 : 1], !pos.white);

function pseudoMoves(pos: Pos, capturesOnly: boolean): EMove[] {
  const out: EMove[] = [];
  const b = pos.board;
  const mine = pos.white ? 0 : BLACK;
  const isEnemy = (v: number) => v !== 0 && (v & BLACK) !== mine;
  const add = (from: number, to: number, piece: number, captured: number, flag: EMove["flag"] = 0) => {
    const type = piece & 7;
    const lastRow = pos.white ? 0 : 7;
    if (type === P && to >> 4 === lastRow) for (const promo of [Q, N, R, B]) out.push({ from, to, piece, captured, promo, flag });
    else out.push({ from, to, piece, captured, promo: 0, flag });
  };
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const v = b[sq];
    if (!v || (v & BLACK) !== mine) continue;
    const type = v & 7;
    if (type === P) {
      const up = pos.white ? -16 : 16;
      const startRow = pos.white ? 6 : 1;
      const one = sq + up;
      if (!capturesOnly || one >> 4 === (pos.white ? 0 : 7)) {
        if (!(one & 0x88) && !b[one]) {
          add(sq, one, v, 0);
          const two = one + up;
          if (!capturesOnly && sq >> 4 === startRow && !b[two]) add(sq, two, v, 0, 3);
        }
      }
      for (const d of [up - 1, up + 1]) {
        const s = sq + d;
        if (s & 0x88) continue;
        if (isEnemy(b[s])) add(sq, s, v, b[s]);
        else if (s === pos.ep) add(sq, s, v, P + (BLACK - mine), 1);
      }
    } else if (type === N || type === K) {
      for (const d of type === N ? KNIGHT : KING) {
        const s = sq + d;
        if (s & 0x88) continue;
        if (!b[s]) {
          if (!capturesOnly) add(sq, s, v, 0);
        } else if (isEnemy(b[s])) add(sq, s, v, b[s]);
      }
      if (type === K && !capturesOnly) {
        // Castling: the squares between are empty, and the king doesn't start in, pass or land in check
        const [short, long] = pos.white ? [1, 2] : [4, 8];
        const enemyWhite = !pos.white;
        if (pos.castle & short && !b[sq + 1] && !b[sq + 2] && b[sq + 3] === R + mine && !attacked(pos, sq, enemyWhite) && !attacked(pos, sq + 1, enemyWhite))
          add(sq, sq + 2, v, 0, 2);
        if (pos.castle & long && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && b[sq - 4] === R + mine && !attacked(pos, sq, enemyWhite) && !attacked(pos, sq - 1, enemyWhite))
          add(sq, sq - 2, v, 0, 2);
      }
    } else {
      const dirs = type === B ? DIAG : type === R ? LINE : [...DIAG, ...LINE];
      for (const d of dirs) {
        for (let s = sq + d; !(s & 0x88); s += d) {
          if (!b[s]) {
            if (!capturesOnly) add(sq, s, v, 0);
            continue;
          }
          if (isEnemy(b[s])) add(sq, s, v, b[s]);
          break;
        }
      }
    }
  }
  return out;
}

// Which castling rights a move through this square removes
const CASTLE_MASK = new Map<number, number>([
  [sqOf("e1"), 3],
  [sqOf("h1"), 1],
  [sqOf("a1"), 2],
  [sqOf("e8"), 12],
  [sqOf("h8"), 4],
  [sqOf("a8"), 8],
]);

function make(pos: Pos, m: EMove): Undo {
  const undo = { castle: pos.castle, ep: pos.ep, captured: m.captured };
  const b = pos.board;
  b[m.to] = m.promo ? m.promo + (m.piece & BLACK) : m.piece;
  b[m.from] = 0;
  if (m.flag === 1) b[m.to + (pos.white ? 16 : -16)] = 0; // en passant: the pawn behind
  if (m.flag === 2) {
    // castling: move the rook too
    if (m.to > m.from) [b[m.to - 1], b[m.to + 1]] = [b[m.to + 1], 0];
    else [b[m.to + 1], b[m.to - 2]] = [b[m.to - 2], 0];
  }
  if ((m.piece & 7) === K) pos.kings[pos.white ? 0 : 1] = m.to;
  pos.castle &= ~((CASTLE_MASK.get(m.from) ?? 0) | (CASTLE_MASK.get(m.to) ?? 0));
  pos.ep = m.flag === 3 ? (m.from + m.to) >> 1 : -1;
  pos.white = !pos.white;
  return undo;
}

function unmake(pos: Pos, m: EMove, u: Undo) {
  pos.white = !pos.white;
  const b = pos.board;
  b[m.from] = m.piece;
  b[m.to] = m.flag === 1 ? 0 : u.captured;
  if (m.flag === 1) b[m.to + (pos.white ? 16 : -16)] = u.captured;
  if (m.flag === 2) {
    if (m.to > m.from) [b[m.to + 1], b[m.to - 1]] = [b[m.to - 1], 0];
    else [b[m.to - 2], b[m.to + 1]] = [b[m.to + 1], 0];
  }
  if ((m.piece & 7) === K) pos.kings[pos.white ? 0 : 1] = m.from;
  pos.castle = u.castle;
  pos.ep = u.ep;
}

/** Legal moves: pseudo-legal ones that don't leave your own king in check */
export function legalMoves(pos: Pos, capturesOnly = false): EMove[] {
  return pseudoMoves(pos, capturesOnly).filter((m) => {
    const u = make(pos, m);
    const ok = !attacked(pos, pos.kings[pos.white ? 1 : 0], pos.white);
    unmake(pos, m, u);
    return ok;
  });
}

/** Count the positions after `depth` moves: tests compare this to the well-known numbers */
export function perft(fen: string, depth: number): number {
  const pos = fromFen(fen);
  const walk = (d: number): number => {
    if (d === 0) return 1;
    let n = 0;
    for (const m of legalMoves(pos)) {
      const u = make(pos, m);
      n += walk(d - 1);
      unmake(pos, m, u);
    }
    return n;
  };
  return walk(depth);
}

// --- scoring -----------------------------------------------------------------------------------

const VALUE = [0, 100, 320, 330, 500, 900, 0];

// Bonuses from white's side, rank 8 first (row 0) to rank 1 (row 7). Black reads them mirrored.
// Simple ideas: pawns forward and central, knights in the middle, king tucked away early.
const PST: number[][] = [
  [],
  [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
];

/** Score from white's point of view (positive = white is better) */
export function evaluatePos(pos: Pos): number {
  let score = 0;
  const b = pos.board;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const v = b[sq];
    if (!v) continue;
    const type = v & 7;
    const row = sq >> 4;
    const col = sq & 7;
    if (v & BLACK) score -= VALUE[type] + PST[type][(7 - row) * 8 + col];
    else score += VALUE[type] + PST[type][row * 8 + col];
  }
  return score;
}
export const evaluate = (fen: string) => evaluatePos(fromFen(fen));

// --- searching ---------------------------------------------------------------------------------

const MATE = 100_000;

// Try the likely-best moves first (big captures by small pieces, promotions): alpha-beta prunes more
function order(moves: EMove[]): EMove[] {
  const guess = (m: EMove) => (m.captured ? 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7] : 0) + (m.promo ? VALUE[m.promo] : 0);
  return moves.sort((a, b) => guess(b) - guess(a));
}

type Search = { nodes: number; maxNodes: number; quiescence: boolean };

function quiesce(pos: Pos, alpha: number, beta: number, s: Search, depth: number): number {
  s.nodes++;
  const stand = (pos.white ? 1 : -1) * evaluatePos(pos);
  if (stand >= beta || depth > 6) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of order(legalMoves(pos, true))) {
    const u = make(pos, m);
    const score = -quiesce(pos, -beta, -alpha, s, depth + 1);
    unmake(pos, m, u);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

// Negamax: the best score for the side to move
function search(pos: Pos, depth: number, alpha: number, beta: number, s: Search, ply: number): number {
  s.nodes++;
  const moves = legalMoves(pos);
  if (moves.length === 0) return inCheck(pos) ? -MATE + ply : 0; // mate (sooner is better for the winner) or stalemate
  if (depth <= 0) return s.quiescence ? quiesce(pos, alpha, beta, s, 0) : (pos.white ? 1 : -1) * evaluatePos(pos);
  let best = -Infinity;
  for (const m of order(moves)) {
    const u = make(pos, m);
    const score = -search(pos, depth - 1, -beta, -alpha, s, ply + 1);
    unmake(pos, m, u);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  return best;
}

/** A small seeded random number generator (mulberry32) */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nook's move for this position, as {from, to, promotion}; null when there is no legal move */
export function bestMove(fen: string, level: Level, random: () => number = Math.random): { from: string; to: string; promotion?: string } | null {
  const pos = fromFen(fen);
  const cfg = LEVELS[level - 1];
  let moves = order(legalMoves(pos));
  if (moves.length === 0) return null;
  const s: Search = { nodes: 0, maxNodes: cfg.maxNodes, quiescence: cfg.quiescence };
  const noise = new Map(moves.map((m) => [m, (random() * 2 - 1) * cfg.noise]));
  let best = moves[0];
  // Iterative deepening: search 1 move deep, then 2…, best move first each time; stop when the budget is spent
  for (let depth = 1; depth <= cfg.depth; depth++) {
    let bestScore = -Infinity;
    let bestHere = moves[0];
    const scores = new Map<EMove, number>();
    for (const m of moves) {
      const u = make(pos, m);
      let score = -search(pos, depth - 1, -Infinity, -bestScore + cfg.noise * 2, s, 1);
      unmake(pos, m, u);
      if (Math.abs(score) < MATE / 2) score += noise.get(m)!; // never "forget" a mate
      scores.set(m, score);
      if (score > bestScore) {
        bestScore = score;
        bestHere = m;
      }
    }
    best = bestHere;
    if (bestScore > MATE / 2 || s.nodes > s.maxNodes) break;
    moves = [...moves].sort((a, b) => scores.get(b)! - scores.get(a)!);
  }
  return { from: sqName(best.from), to: sqName(best.to), ...(best.promo && { promotion: LETTERS[best.promo] }) };
}
