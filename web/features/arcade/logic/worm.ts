// Hungry Worm's rules, without any drawing: a grid, a worm (list of cells, head first), a snack.

export type Cell = { x: number; y: number };
export type Dir = "up" | "down" | "left" | "right";
export type Snack = Cell & { emoji: string; spicy: boolean };
export type WormState = {
  size: number;
  worm: Cell[];
  dir: Dir;
  snack: Snack;
  score: number;
  eaten: number;
  alive: boolean;
};

export const SNACKS = ["🍎", "🍕", "🍩", "🧀", "🍉", "🍓", "🍔", "🧁"];
const MOVES: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function newGame(size = 16, random = Math.random): WormState {
  const mid = Math.floor(size / 2);
  const worm = [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
  return {
    size,
    worm,
    dir: "right",
    snack: placeSnack(size, worm, 0, random),
    score: 0,
    eaten: 0,
    alive: true,
  };
}

// You can't turn straight back into your own neck.
export function turn(current: Dir, wanted: Dir): Dir {
  return wanted === OPPOSITE[current] ? current : wanted;
}

export function placeSnack(size: number, worm: Cell[], eaten: number, random = Math.random): Snack {
  const free: Cell[] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!worm.some((c) => c.x === x && c.y === y)) free.push({ x, y });
  const cell = free[Math.floor(random() * free.length)] ?? { x: 0, y: 0 };
  const spicy = eaten > 0 && eaten % 5 === 4; // every 5th snack is a chilli
  return {
    ...cell,
    spicy,
    emoji: spicy ? "🌶️" : SNACKS[Math.floor(random() * SNACKS.length)],
  };
}

// One tick: move the head one cell. Eat → grow (the tail stays). Wall or self → dead.
export function step(state: WormState, random = Math.random): WormState {
  if (!state.alive) return state;
  const head = state.worm[0];
  const move = MOVES[state.dir];
  const next = { x: head.x + move.x, y: head.y + move.y };
  const eats = next.x === state.snack.x && next.y === state.snack.y;
  const body = eats ? state.worm : state.worm.slice(0, -1); // the tail moves away, unless we grow
  const hitsWall = next.x < 0 || next.y < 0 || next.x >= state.size || next.y >= state.size;
  if (hitsWall || body.some((c) => c.x === next.x && c.y === next.y)) return { ...state, alive: false };

  const worm = [next, ...body];
  if (!eats) return { ...state, worm };
  const eaten = state.eaten + 1;
  return {
    ...state,
    worm,
    eaten,
    score: state.score + (state.snack.spicy ? 20 : 10),
    snack: placeSnack(state.size, worm, eaten, random),
  };
}

// Faster as you eat: 150 ms per step at the start, never under 65 ms.
export function tickMs(eaten: number): number {
  return Math.max(65, 150 - eaten * 4);
}
