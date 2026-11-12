// Stage 22: one Listen Together room, as plain data + functions (no network code, tested with a fake clock).
//
// "In sync" works like this: the server says "this song started at <server time> (or is paused at second N)".
// Each browser measures how far its clock is from the server's (a ping, see server.ts "time") and plays from
// the right second. A browser joining late starts mid-song, in step with everyone else.

export type Song = { id: number; title: string; artist: string; durationSec: number | null; audioUrl: string; artworkUrl: string | null };
export type Person = { id: string; name: string };
export type QueueItem = { key: number; song: Song; addedBy: Person; votes: Set<string>; addedAt: number };
export type NowPlaying = { key: number; song: Song; addedBy: Person; startedAt: number; pausedAt: number | null };

export type ListenRoom = {
  name: string;
  hostId: string;
  everyoneControls: boolean; // false: only the host can pause or skip straight away
  queue: QueueItem[];
  now: NowPlaying | null;
  skipVotes: Set<string>;
  nextKey: number;
};

export const MAX_QUEUE = 50;

export function newListenRoom(name: string, host: Person): ListenRoom {
  return { name, hostId: host.id, everyoneControls: true, queue: [], now: null, skipVotes: new Set(), nextKey: 1 };
}

// Most votes first; equal votes keep the order they were added in
function sortQueue(r: ListenRoom) {
  r.queue.sort((a, b) => b.votes.size - a.votes.size || a.addedAt - b.addedAt);
}

export function addSong(r: ListenRoom, who: Person, song: Song, now: number): string | null {
  if (r.queue.length >= MAX_QUEUE) return "The queue is full";
  if (r.queue.some((q) => q.song.id === song.id) || r.now?.song.id === song.id) return "That song is already in the queue";
  r.queue.push({ key: r.nextKey++, song, addedBy: who, votes: new Set([who.id]), addedAt: now });
  sortQueue(r);
  if (!r.now) next(r, now);
  return null;
}

export function toggleVote(r: ListenRoom, who: Person, key: number) {
  const item = r.queue.find((q) => q.key === key);
  if (!item) return;
  if (item.votes.has(who.id)) item.votes.delete(who.id);
  else item.votes.add(who.id);
  sortQueue(r);
}

export function removeFromQueue(r: ListenRoom, who: Person, key: number): string | null {
  const item = r.queue.find((q) => q.key === key);
  if (!item) return null;
  if (item.addedBy.id !== who.id && who.id !== r.hostId) return "Only who added it, or the host, can remove it";
  r.queue = r.queue.filter((q) => q.key !== key);
  return null;
}

// Play the top of the queue (or nothing)
export function next(r: ListenRoom, now: number) {
  const top = r.queue.shift();
  r.skipVotes.clear();
  r.now = top ? { key: top.key, song: top.song, addedBy: top.addedBy, startedAt: now, pausedAt: null } : null;
}

// Skip: straight away for the host (or anyone, if everyone controls); otherwise when more than half vote
export function voteSkip(r: ListenRoom, who: Person, listeners: number, now: number): "skipped" | "voted" {
  if (!r.now) return "voted";
  if (who.id === r.hostId || r.everyoneControls) {
    next(r, now);
    return "skipped";
  }
  r.skipVotes.add(who.id);
  if (r.skipVotes.size * 2 > listeners) {
    next(r, now);
    return "skipped";
  }
  return "voted";
}

export function canControl(r: ListenRoom, who: Person) {
  return who.id === r.hostId || r.everyoneControls;
}

// Seconds into the current song
export function positionAt(r: ListenRoom, now: number): number {
  if (!r.now) return 0;
  return ((r.now.pausedAt ?? now) - r.now.startedAt) / 1000;
}

export function pause(r: ListenRoom, now: number) {
  if (r.now && r.now.pausedAt === null) r.now.pausedAt = now;
}

export function resume(r: ListenRoom, now: number) {
  if (r.now && r.now.pausedAt !== null) {
    r.now.startedAt += now - r.now.pausedAt; // shift the start so the position carries on from where it stopped
    r.now.pausedAt = null;
  }
}

export function seek(r: ListenRoom, seconds: number, now: number) {
  if (!r.now) return;
  const s = Math.max(0, Math.min(seconds, r.now.song.durationSec ?? seconds));
  r.now.startedAt = (r.now.pausedAt ?? now) - s * 1000;
}

// The song ended (by its length, or a browser says so): next one. `key` guards against a late "ended" message.
export function songEnded(r: ListenRoom, key: number, now: number): boolean {
  if (!r.now || r.now.key !== key || r.now.pausedAt !== null) return false;
  if (positionAt(r, now) < Math.min(5, (r.now.song.durationSec ?? 5) - 1)) return false; // too early: not believable
  next(r, now);
  return true;
}

// When the current song should end by itself (null: unknown length, or paused)
export function endsAt(r: ListenRoom): number | null {
  if (!r.now || r.now.pausedAt !== null || !r.now.song.durationSec) return null;
  return r.now.startedAt + r.now.song.durationSec * 1000 + 1000;
}

export function listenView(r: ListenRoom, viewerId: string | null, now: number) {
  return {
    name: r.name,
    hostId: r.hostId,
    everyoneControls: r.everyoneControls,
    serverNow: now,
    now: r.now && { key: r.now.key, song: r.now.song, addedBy: r.now.addedBy, startedAt: r.now.startedAt, pausedAt: r.now.pausedAt },
    queue: r.queue.map((q) => ({ key: q.key, song: q.song, addedBy: q.addedBy, votes: q.votes.size, voted: viewerId ? q.votes.has(viewerId) : false })),
    skipVotes: r.skipVotes.size,
  };
}
export type ListenView = ReturnType<typeof listenView>;
