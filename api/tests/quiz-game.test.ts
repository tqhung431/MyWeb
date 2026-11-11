// Stage 14: Quiz Party's rules, with a fake clock (no waiting, no sockets).

import { describe, expect, it } from "vitest";
import { Game, GameError, points, type Clock } from "../src/arcade-online/game.js";
import { pickQuestions, QUESTIONS, type Question } from "../src/arcade-online/questions.js";

function fakeClock() {
  let t = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let next = 1;
  const clock: Clock = {
    now: () => t,
    set: (ms, fn) => {
      const id = next++;
      timers.push({ at: t + ms, fn, id });
      return id;
    },
    clear: (id) => (timers = timers.filter((x) => x.id !== id)),
  };
  const advance = (ms: number) => {
    t += ms;
    for (;;) {
      const due = timers.filter((x) => x.at <= t).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      timers = timers.filter((x) => x !== due);
      due.fn();
    }
  };
  return { clock, advance };
}

const Q = (answer: 0 | 1 | 2 | 3): Question => ({ category: "general", text: "?", choices: ["a", "b", "c", "d"], answer });
const linh = { id: "u1", name: "Linh" };
const mai = { id: "u2", name: "Mai" };

function newGame(rounds = 2) {
  const { clock, advance } = fakeClock();
  const finished: string[][] = [];
  const g = new Game(
    "ABCD",
    linh,
    { clock, rounds, questionMs: 10_000, revealMs: 3_000, pick: (n) => [Q(1), Q(2), Q(0)].slice(0, n) },
    undefined,
    (_g, ranking) => finished.push(ranking.map((p) => p.name)),
  );
  return { g, advance, finished };
}

describe("scoring", () => {
  it("gives 500 for a right answer plus up to 500 for speed", () => {
    expect(points(true, 0, 15_000)).toBe(1000);
    expect(points(true, 7_500, 15_000)).toBe(750);
    expect(points(true, 15_000, 15_000)).toBe(500);
    expect(points(false, 0, 15_000)).toBe(0);
  });
});

describe("a game", () => {
  it("goes lobby → question → reveal → … → final, and ranks by points", () => {
    const { g, advance, finished } = newGame();
    g.join(mai);
    expect(() => g.start(mai.id)).toThrow(GameError); // only the host
    g.start(linh.id);
    expect(g.phase).toBe("question");
    const s = g.snapshot();
    expect("question" in s && s.question.text).toBe("?");
    expect(JSON.stringify(s)).not.toContain('"answer"'); // the right answer isn't sent during the question

    advance(2_000);
    g.answer(linh.id, 0, 1); // right, after 2 s
    expect(g.phase).toBe("question"); // Mai hasn't answered
    advance(1_000);
    g.answer(mai.id, 0, 3); // wrong
    expect(g.phase).toBe("reveal"); // everyone answered: no need to wait
    expect(g.players.get(linh.id)!.score).toBe(900);

    advance(3_000); // reveal over → question 2; nobody answers
    expect(g.phase).toBe("question");
    advance(10_000); // time's up
    expect(g.phase).toBe("reveal");
    advance(3_000);
    expect(g.phase).toBe("final");
    expect(finished).toEqual([["Linh", "Mai"]]);
  });

  it("refuses late, double, impossible and out-of-turn answers", () => {
    const { g, advance } = newGame();
    g.join(mai);
    g.start(linh.id);
    expect(() => g.answer(linh.id, 1, 0)).toThrow("Too late"); // not that question
    expect(() => g.answer(linh.id, 0, 7)).toThrow("Pick one");
    expect(() => g.answer("stranger", 0, 1)).toThrow("not in this game");
    g.answer(linh.id, 0, 1);
    expect(() => g.answer(linh.id, 0, 2)).toThrow("already answered");
    advance(10_001); // time's up → reveal
    expect(() => g.answer(mai.id, 0, 1)).toThrow();
  });

  it("doesn't let new people in once started, but lets players come back", () => {
    const { g } = newGame();
    g.join(mai);
    g.start(linh.id);
    expect(() => g.join({ id: "u3", name: "Bao" })).toThrow("already started");
    g.leave(mai.id);
    expect(g.players.get(mai.id)!.connected).toBe(false); // stays on the scoreboard
    g.join(mai);
    expect(g.players.get(mai.id)!.connected).toBe(true);
  });

  it("passes the host on when the host leaves, and stops waiting for people who left", () => {
    const { g } = newGame();
    g.join(mai);
    g.start(linh.id);
    g.answer(mai.id, 0, 1);
    g.leave(linh.id); // Linh drops out mid-question: Mai was the only one left to wait for
    expect(g.hostId).toBe(mai.id);
    expect(g.phase).toBe("reveal");
  });

  it("can be played again from the start", () => {
    const { g, advance } = newGame(1);
    g.start(linh.id);
    g.answer(linh.id, 0, 1);
    advance(3_000);
    expect(g.phase).toBe("final");
    g.playAgain(linh.id);
    expect(g.phase).toBe("lobby");
    expect(g.players.get(linh.id)!.score).toBe(0);
  });

  it("is full at 8", () => {
    const { g } = newGame();
    for (let i = 2; i <= 8; i++) g.join({ id: `u${i}`, name: `P${i}` });
    expect(() => g.join({ id: "u9", name: "P9" })).toThrow("full");
  });
});

describe("questions", () => {
  it("are well formed, and picked without repeats", () => {
    for (const q of QUESTIONS) {
      expect(q.choices).toHaveLength(4);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(3);
    }
    expect(new Set(QUESTIONS.map((q) => q.text)).size).toBe(QUESTIONS.length);
    const ten = pickQuestions(10);
    expect(new Set(ten).size).toBe(10);
    expect(pickQuestions(10, "food").every((q) => q.category === "food")).toBe(true);
  });
});
