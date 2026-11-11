"use client";

// Arcade Online's front page: start a Quiz Party room, join one by its code, or pick an open room.

import { Crown, Loader2, LogIn, Plus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { NameForm } from "@/features/me/NameForm";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { getCategories, getRooms, type Ack, type CategoryId, type OpenRoom } from "@/lib/api/arcadeOnline";

const PHASE = { lobby: "Waiting to start", question: "Playing", reveal: "Playing", final: "Finished" } as const;

export function Lobby() {
  const { user, setUser } = useMe();
  const { socket, connected } = useRealtime();
  const router = useRouter();
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [categories, setCategories] = useState<{ id: CategoryId; label: string; questions: number }[]>([]);
  const [category, setCategory] = useState<CategoryId>("mixed");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => getRooms().then(setRooms, () => {}), []);
  useEffect(() => {
    void load();
    getCategories().then(setCategories, () => {});
  }, [load]);
  useRealtimeEvent("ao:rooms", () => void load());

  if (!user) {
    return (
      <div className="max-w-xl rounded-3xl border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-bold">Pick a name to play</h2>
        <p className="mt-1 mb-4 text-sm text-muted">Everyone in the room sees it on the scoreboard.</p>
        <NameForm mode="pick" onDone={setUser} />
      </div>
    );
  }

  const go = (event: string, payload: unknown) => {
    if (!socket) return;
    setBusy(true);
    setError("");
    socket.emit(event, payload, (ack: Ack) => {
      setBusy(false);
      if (ack.ok && ack.code) router.push(`/arcade-online/${ack.code}`);
      else setError(ack.error ?? "That didn't work");
    });
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    go("ao:join", { code });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-6">
        <section className="overflow-hidden rounded-3xl bg-linear-to-br from-rose-400 to-red-500 p-6 text-white shadow-card sm:p-8">
          <p className="text-5xl" aria-hidden="true">
            🎉
          </p>
          <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Quiz Party</h2>
          <p className="mt-1 max-w-md text-white/90">Play live against everyone on Nook: 10 questions, 15 seconds each. Right and fast wins.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
              aria-label="Questions about"
              className="h-11 rounded-full border-0 bg-white/20 px-4 font-semibold text-white backdrop-blur focus:outline-none [&>option]:text-slate-900"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <Button size="md" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => go("ao:create", { category })} disabled={!connected || busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />} Start a room
            </Button>
          </div>
        </section>

        <Card>
          <CardHeader title="Join with a code" subtitle="Someone started a room? Type the 4 letters they see." />
          <form onSubmit={join} className="flex gap-2">
            <input
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 4),
                )
              }
              placeholder="ABCD"
              aria-label="Room code"
              autoCapitalize="characters"
              className="h-12 w-36 rounded-2xl border border-border bg-surface-strong/70 text-center text-2xl font-bold tracking-[0.3em] uppercase focus:border-primary focus:outline-none"
            />
            <Button type="submit" variant="primary" disabled={code.length !== 4 || !connected || busy}>
              <LogIn className="h-4 w-4" aria-hidden="true" /> Join
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          {!connected && <p className="mt-2 text-sm text-muted">Connecting to Nook…</p>}
        </Card>
      </div>

      <Card>
        <CardHeader title="Open rooms" subtitle="Updates live" />
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">No rooms right now. Start one and tell the others the code!</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => go("ao:join", { code: r.code })}
                  disabled={r.phase !== "lobby" || r.players >= r.max}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border p-3 text-left transition hover:border-primary/40 disabled:cursor-default disabled:opacity-60"
                >
                  <span className="rounded-xl bg-rose-500/12 px-2.5 py-1.5 font-mono text-sm font-bold text-rose-600 dark:text-rose-300">{r.code}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-semibold">
                      <Crown className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" /> {r.host}
                    </span>
                    <span className="block text-xs text-muted">
                      {r.category} · {PHASE[r.phase]}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> {r.players}/{r.max}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
