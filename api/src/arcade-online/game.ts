// One Quiz Party game (Stage 14), run by the SERVER: it holds the right answers, starts and stops the clock,
// measures how fast each answer arrived, and adds up the points. Browsers only send "I pick choice 2"
// and draw what the server tells them, so a score can't be faked from DevTools (unlike Mini Arcade).
//
//   lobby ──start──► question ──(everyone answered, or time up)──► reveal ──(4 s)──► question … ──► final
//     ▲                                                                                              │
//     └──────────────────────────────────── play again ─────────────────────────────────────────────┘
//
// No sockets in here: the room manager (rooms.ts) connects it to Socket.IO. Tests drive it directly.

import { pickQuestions, type Category, type Question } from "./questions.js";

export type Phase = "lobby" | "question" | "reveal" | "final";
export type Player = { id: string; name: string; score: number; correct: number; connected: boolean };
type Answer = { choice: number; ms: number; gained: number };

export type Clock = {
  now: () => number;
  set: (ms: number, fn: () => void) => unknown;
  clear: (handle: unknown) => void;
};
export const realClock: Clock = { now: () => Date.now(), set: (ms, fn) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as NodeJS.Timeout) };

export type GameOptions = {
  questionMs: number;
  revealMs: number;
  rounds: number;
  maxPlayers: number;
  clock: Clock;
  pick: (count: number, category: Category | "mixed") => Question[];
};
export const DEFAULTS: GameOptions = { questionMs: 15_000, revealMs: 4_000, rounds: 10, maxPlayers: 8, clock: realClock, pick: pickQuestions };

// Right answer: 500 points, plus up to 500 more for speed (answer at once: 1000; at the last moment: 500).
export function points(correct: boolean, ms: number, limitMs: number): number {
  if (!correct) return 0;
  return 500 + Math.round(500 * Math.max(0, 1 - ms / limitMs));
}

export class GameError extends Error {}

export class Game {
  phase: Phase = "lobby";
  hostId: string;
  category: Category | "mixed" = "mixed";
  players = new Map<string, Player>();
  private questions: Question[] = [];
  private index = -1;
  private askedAt = 0;
  private endsAt = 0;
  private answers = new Map<string, Answer>();
  private timer: unknown = null;
  readonly opts: GameOptions;

  constructor(
    readonly code: string,
    host: { id: string; name: string },
    opts: Partial<GameOptions> = {},
    private onChange: (g: Game) => void = () => {},
    private onFinish: (g: Game, ranking: Player[]) => void = () => {},
  ) {
    this.opts = { ...DEFAULTS, ...opts };
    this.hostId = host.id;
    this.join(host);
  }

  // --- people ----------------------------------------------------------------------------

  join(user: { id: string; name: string }) {
    const known = this.players.get(user.id);
    if (known) {
      known.connected = true; // came back (another tab, or reconnected)
      known.name = user.name;
    } else {
      if (this.phase !== "lobby") throw new GameError("This game has already started. Wait for the next one!");
      if (this.players.size >= this.opts.maxPlayers) throw new GameError(`This room is full (${this.opts.maxPlayers} players)`);
      this.players.set(user.id, { id: user.id, name: user.name, score: 0, correct: 0, connected: true });
    }
    this.onChange(this);
  }

  // In the lobby you're removed; during a game you stay on the scoreboard, shown as away.
  leave(userId: string) {
    const p = this.players.get(userId);
    if (!p) return;
    if (this.phase === "lobby" || this.phase === "final") this.players.delete(userId);
    else p.connected = false;
    if (this.hostId === userId) {
      const next = [...this.players.values()].find((x) => x.connected);
      if (next) this.hostId = next.id;
    }
    if (this.phase === "question" && this.everyoneAnswered()) this.reveal();
    else this.onChange(this);
  }

  get connectedCount() {
    return [...this.players.values()].filter((p) => p.connected).length;
  }

  // --- the host's buttons ----------------------------------------------------------------------

  private hostOnly(userId: string) {
    if (userId !== this.hostId) throw new GameError("Only the host can do that");
  }

  setCategory(userId: string, category: Category | "mixed") {
    this.hostOnly(userId);
    if (this.phase !== "lobby") throw new GameError("The game has started");
    this.category = category;
    this.onChange(this);
  }

  start(userId: string) {
    this.hostOnly(userId);
    if (this.phase !== "lobby") throw new GameError("The game has started");
    this.questions = this.opts.pick(this.opts.rounds, this.category);
    if (this.questions.length === 0) throw new GameError("No questions in that category");
    for (const p of this.players.values()) Object.assign(p, { score: 0, correct: 0 });
    this.index = -1;
    this.nextQuestion();
  }

  playAgain(userId: string) {
    this.hostOnly(userId);
    if (this.phase !== "final") throw new GameError("The game isn't over yet");
    for (const [id, p] of this.players) if (!p.connected) this.players.delete(id);
    for (const p of this.players.values()) Object.assign(p, { score: 0, correct: 0 });
    this.phase = "lobby";
    this.onChange(this);
  }

  // --- the rounds --------------------------------------------------------------------------------

  answer(userId: string, questionIndex: number, choice: number) {
    const p = this.players.get(userId);
    if (!p) throw new GameError("You're not in this game");
    if (this.phase !== "question" || questionIndex !== this.index) throw new GameError("Too late for that question");
    if (this.answers.has(userId)) throw new GameError("You already answered");
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) throw new GameError("Pick one of the four answers");
    const ms = this.opts.clock.now() - this.askedAt;
    if (ms > this.opts.questionMs) throw new GameError("Time's up");
    const q = this.questions[this.index];
    this.answers.set(userId, { choice, ms, gained: points(choice === q.answer, ms, this.opts.questionMs) });
    if (this.everyoneAnswered()) this.reveal();
    else this.onChange(this);
  }

  private everyoneAnswered() {
    const here = [...this.players.values()].filter((p) => p.connected);
    return here.length > 0 && here.every((p) => this.answers.has(p.id));
  }

  private nextQuestion() {
    this.opts.clock.clear(this.timer);
    this.index++;
    if (this.index >= this.questions.length) return this.finish();
    this.phase = "question";
    this.answers = new Map();
    this.askedAt = this.opts.clock.now();
    this.endsAt = this.askedAt + this.opts.questionMs;
    this.timer = this.opts.clock.set(this.opts.questionMs, () => this.reveal());
    this.onChange(this);
  }

  private reveal() {
    if (this.phase !== "question") return;
    this.opts.clock.clear(this.timer);
    const q = this.questions[this.index];
    for (const [id, a] of this.answers) {
      const p = this.players.get(id);
      if (!p) continue;
      p.score += a.gained;
      if (a.choice === q.answer) p.correct++;
    }
    this.phase = "reveal";
    this.timer = this.opts.clock.set(this.opts.revealMs, () => this.nextQuestion());
    this.onChange(this);
  }

  private finish() {
    this.phase = "final";
    this.onChange(this);
    this.onFinish(this, this.ranking());
  }

  ranking(): Player[] {
    return [...this.players.values()].sort((a, b) => b.score - a.score || b.correct - a.correct || a.name.localeCompare(b.name));
  }

  dispose() {
    this.opts.clock.clear(this.timer);
  }

  // --- what browsers see -------------------------------------------------------------------------
  // During a question: the question and who has answered (not what). The right answer only at reveal.

  snapshot() {
    const q = this.questions[this.index];
    const base = {
      code: this.code,
      hostId: this.hostId,
      category: this.category,
      phase: this.phase,
      serverNow: this.opts.clock.now(),
      round: this.index + 1,
      rounds: this.questions.length || this.opts.rounds,
      players: this.ranking().map((p) => ({ ...p, answered: this.phase === "question" && this.answers.has(p.id) })),
    };
    if (this.phase === "question")
      return { ...base, question: { text: q.text, choices: q.choices, category: q.category, endsAt: this.endsAt, ms: this.opts.questionMs } };
    if (this.phase === "reveal")
      return {
        ...base,
        question: { text: q.text, choices: q.choices, category: q.category, endsAt: this.endsAt, ms: this.opts.questionMs },
        reveal: { answer: q.answer, results: Object.fromEntries([...this.answers].map(([id, a]) => [id, { choice: a.choice, gained: a.gained, ms: a.ms }])) },
      };
    return base;
  }
}

export type Snapshot = ReturnType<Game["snapshot"]>;
