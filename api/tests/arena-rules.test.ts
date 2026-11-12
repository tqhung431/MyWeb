// Stage 22: the rules of a live chess game and a Listen Together room, with a fake clock (no network, no database).
import { describe, expect, it } from "vitest";
import * as C from "../src/arena/chess-game.js";
import * as L from "../src/arena/listen.js";

const ann = { id: "a", name: "Ann" };
const bou = { id: "b", name: "Bou" };
const cat = { id: "c", name: "Cat" };

describe("chess game", () => {
  it("plays Fool's mate: black wins by checkmate", () => {
    const g = C.newChessGame(ann, bou, "none", 0);
    expect(C.playMove(g, "a", { from: "f2", to: "f3" }, 1)).toBeNull();
    expect(C.playMove(g, "b", { from: "e7", to: "e5" }, 2)).toBeNull();
    expect(C.playMove(g, "a", { from: "g2", to: "g4" }, 3)).toBeNull();
    expect(C.playMove(g, "b", { from: "d8", to: "h4" }, 4)).toBeNull();
    expect(g.result).toEqual({ result: "0-1", reason: "checkmate" });
    expect(C.playMove(g, "a", { from: "e2", to: "e4" }, 5)).toBe("The game is over");
    expect(g.chess.pgn()).toContain('[Result "0-1"]');
  });

  it("refuses moves out of turn, by watchers, and illegal ones", () => {
    const g = C.newChessGame(ann, bou, "none", 0);
    expect(C.playMove(g, "b", { from: "e7", to: "e5" }, 1)).toBe("It's not your turn");
    expect(C.playMove(g, "c", { from: "e2", to: "e4" }, 1)).toBe("You're watching this game");
    expect(C.playMove(g, "a", { from: "e2", to: "e5" }, 1)).toBe("That move isn't allowed");
  });

  it("runs the clocks with the increment, and flags whoever runs out", () => {
    const g = C.newChessGame(ann, bou, "15+10", 0);
    C.playMove(g, "a", { from: "e2", to: "e4" }, 5_000); // white spent 5 s, gets 10 s back
    expect(g.clock!.w).toBe(15 * 60_000 - 5_000 + 10_000);
    expect(C.clocksAt(g, 65_000)!.b).toBe(15 * 60_000 - 60_000); // black has been thinking for a minute
    expect(C.flagIfOut(g, 5_000 + 15 * 60_000 - 1)).toBe(false);
    expect(C.flagIfOut(g, 5_000 + 15 * 60_000)).toBe(true);
    expect(g.result).toEqual({ result: "1-0", reason: "time" });
  });

  it("calls it a draw when the side with time left has only a king", () => {
    const g = C.newChessGame(ann, bou, "5+0", 0);
    g.chess.load("8/8/8/4k3/8/8/8/4K2R b - - 0 1"); // black (bare king) to move; white still has a rook
    g.turnStartedAt = 0;
    expect(C.flagIfOut(g, 5 * 60_000)).toBe(true);
    expect(g.result?.result).toBe("1-0"); // white can still mate
    const h = C.newChessGame(ann, bou, "5+0", 0);
    h.chess.load("8/8/8/4k3/8/8/8/4K2R w - - 0 1"); // white to move and flags; black has only a king
    expect(C.flagIfOut(h, 5 * 60_000)).toBe(true);
    expect(h.result).toEqual({ result: "1/2-1/2", reason: "insufficient" });
  });

  it("offers, declines and agrees draws; resigns", () => {
    const g = C.newChessGame(ann, bou, "none", 0);
    expect(C.offerDraw(g, "a")).toBe("offered");
    C.declineDraw(g, "b");
    expect(g.drawOfferBy).toBeNull();
    expect(C.offerDraw(g, "a")).toBe("offered");
    expect(C.offerDraw(g, "b")).toBe("agreed");
    expect(g.result).toEqual({ result: "1/2-1/2", reason: "agreement" });
    const h = C.newChessGame(ann, bou, "none", 0);
    expect(C.resign(h, "b")).toBeNull();
    expect(h.result).toEqual({ result: "1-0", reason: "resign" });
  });

  it("moves Elo ratings: an upset moves them more", () => {
    expect(C.eloChange(1200, 1200, 1)).toBe(16);
    expect(C.eloChange(1200, 1200, 0.5)).toBe(0);
    expect(C.eloChange(1000, 1400, 1)).toBeGreaterThan(25);
    expect(C.eloChange(1400, 1000, 1)).toBeLessThan(6);
  });
});

const song = (id: number, durationSec: number | null = 180): L.Song => ({ id, title: `Song ${id}`, artist: "X", durationSec, audioUrl: `/api/songs/${id}/audio`, artworkUrl: null });

describe("Listen Together room", () => {
  it("plays the first song straight away and queues the rest by votes", () => {
    const r = L.newListenRoom("Friday", ann);
    expect(L.addSong(r, ann, song(1), 0)).toBeNull();
    expect(r.now?.song.id).toBe(1);
    L.addSong(r, bou, song(2), 10);
    L.addSong(r, cat, song(3), 20);
    expect(L.addSong(r, cat, song(3), 30)).toBe("That song is already in the queue");
    L.toggleVote(r, ann, r.queue[1].key); // song 3 now has 2 votes
    expect(r.queue.map((q) => q.song.id)).toEqual([3, 2]);
    expect(L.listenView(r, "a", 0).queue[0]).toMatchObject({ votes: 2, voted: true });
  });

  it("keeps everyone in step: pause, resume and jump shift the start time", () => {
    const r = L.newListenRoom("Friday", ann);
    L.addSong(r, ann, song(1), 1_000);
    expect(L.positionAt(r, 11_000)).toBe(10);
    L.pause(r, 11_000);
    expect(L.positionAt(r, 50_000)).toBe(10);
    L.resume(r, 50_000);
    expect(L.positionAt(r, 52_000)).toBe(12);
    L.seek(r, 100, 52_000);
    expect(L.positionAt(r, 53_000)).toBe(101);
    expect(L.endsAt(r)).toBe(53_000 - 101_000 + 180_000 + 1_000);
  });

  it("only the host skips straight away when everyone-controls is off; others vote", () => {
    const r = L.newListenRoom("Friday", ann);
    r.everyoneControls = false;
    L.addSong(r, ann, song(1), 0);
    L.addSong(r, ann, song(2), 0);
    expect(L.canControl(r, bou)).toBe(false);
    expect(L.voteSkip(r, bou, 3, 1)).toBe("voted");
    expect(L.voteSkip(r, cat, 3, 2)).toBe("skipped"); // 2 of 3
    expect(r.now?.song.id).toBe(2);
    expect(L.voteSkip(r, ann, 3, 3)).toBe("skipped");
    expect(r.now).toBeNull();
  });

  it("ignores a late or too-early 'song ended'", () => {
    const r = L.newListenRoom("Friday", ann);
    L.addSong(r, ann, song(1), 0);
    L.addSong(r, ann, song(2), 0);
    const key = r.now!.key;
    expect(L.songEnded(r, key, 2_000)).toBe(false); // 2 s in: not believable
    expect(L.songEnded(r, key, 179_000)).toBe(true);
    expect(L.songEnded(r, key, 179_500)).toBe(false); // the second browser saying so: ignored
    expect(r.now?.song.id).toBe(2);
  });

  it("only the one who added a song, or the host, removes it", () => {
    const r = L.newListenRoom("Friday", ann);
    L.addSong(r, ann, song(1), 0);
    L.addSong(r, bou, song(2), 0);
    const key = r.queue[0].key;
    expect(L.removeFromQueue(r, cat, key)).toMatch(/Only/);
    expect(L.removeFromQueue(r, bou, key)).toBeNull();
    expect(r.queue).toHaveLength(0);
  });
});
