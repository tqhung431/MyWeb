"use client";

// A Quiz Party room. The server sends the whole room ("ao:state") whenever anything changes; this page only
// draws it and sends your clicks. The countdown uses the server's clock (serverNow), so a phone whose clock
// is a few seconds off still sees the right time.

import { Select } from "@/components/ui/Select";
import { Check, Copy, Crown, Loader2, LogOut, Play, RotateCcw, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { sfx } from "@/features/arcade/sfx";
import { useMe } from "@/features/me/MeProvider";
import { useRealtime, useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import type { Ack, CategoryId, QuizState } from "@/lib/api/arcadeOnline";
import { cn } from "@/lib/cn";

// Four colours AND four shapes, so colour-blind players can tell them apart
const CHOICES = [
  { color: "bg-rose-500", shape: "▲" },
  { color: "bg-sky-500", shape: "◆" },
  { color: "bg-amber-500", shape: "●" },
  { color: "bg-emerald-500", shape: "■" },
];
const CATEGORY_NAMES: Record<CategoryId, string> = {
  mixed: "Mixed",
  general: "General knowledge",
  science: "Science & nature",
  music: "Music",
  screen: "Movies, TV & games",
  food: "Food",
};

export function Room({ code }: { code: string }) {
  const { user } = useMe();
  const { socket, connected } = useRealtime();
  const router = useRouter();
  const [state, setState] = useState<QuizState | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<{ round: number; choice: number } | null>(null);
  const offset = useRef(0); // server clock − this device's clock

  const last = useRef<QuizState | null>(null);
  useRealtimeEvent<QuizState>("ao:state", (s) => {
    if (s.code !== code) return;
    offset.current = s.serverNow - Date.now();
    // little sounds: a new question, the reveal (right or wrong), the end
    const old = last.current;
    if (s.phase === "question" && (old?.phase !== "question" || old.round !== s.round)) sfx("go");
    if (s.phase === "reveal" && old?.phase === "question" && user) {
      const mine = s.reveal?.results[user.id];
      sfx(mine && mine.choice === s.reveal?.answer ? "match" : "miss");
    }
    if (s.phase === "final" && old?.phase !== "final") sfx(s.players[0]?.id === user?.id ? "win" : "lose");
    last.current = s;
    setState(s);
  });

  // Join (and join again after a reconnect: the server keeps your score)
  useEffect(() => {
    if (!socket || !user) return;
    const join = () =>
      socket.emit("ao:join", { code }, (ack: Ack) => {
        if (!ack.ok) setError(ack.error ?? "Can't join this room");
      });
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("connect", join);
    };
  }, [socket, user, code]);

  const send = (event: string, payload: unknown = {}) =>
    new Promise<Ack>((resolve) => {
      if (!socket) return resolve({ ok: false, error: "Not connected" });
      socket.emit(event, payload, (ack: Ack) => {
        if (!ack.ok) setError(ack.error ?? "That didn't work");
        resolve(ack);
      });
    });

  async function leave() {
    await send("ao:leave");
    router.push("/arcade-online");
  }

  if (error && !state) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="font-semibold">{error}</p>
        <Link href="/arcade-online" className={buttonClasses("secondary", "sm")}>
          Back to Quiz Party
        </Link>
      </div>
    );
  }
  if (!state || !user) return <p className="text-sm text-muted">{connected ? "Joining the room…" : "Connecting…"}</p>;

  const host = state.hostId === user.id;
  const me = state.players.find((p) => p.id === user.id);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-muted">
          Room <span className="font-mono text-lg font-bold text-text">{state.code}</span>
          {state.phase !== "lobby" && state.phase !== "final" && (
            <>
              {" · "}Question {state.round} of {state.rounds}
            </>
          )}
        </p>
        <Button variant="ghost" size="sm" onClick={leave}>
          <LogOut className="h-4 w-4" aria-hidden="true" /> Leave
        </Button>
      </header>
      {error && (
        <p className="flex items-center justify-between rounded-2xl bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
          <button type="button" onClick={() => setError("")} aria-label="Close" className="cursor-pointer">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </p>
      )}

      {state.phase === "lobby" && <Waiting state={state} host={host} userId={user.id} send={send} />}
      {(state.phase === "question" || state.phase === "reveal") && state.question && (
        <QuestionView
          state={state}
          userId={user.id}
          offset={offset.current}
          picked={picked?.round === state.round ? picked.choice : null}
          onPick={async (choice) => {
            setPicked({ round: state.round, choice });
            sfx("flip");
            const ack = await send("ao:answer", { round: state.round, choice });
            if (!ack.ok) setPicked(null);
          }}
        />
      )}
      {state.phase === "final" && <Final state={state} host={host} userId={user.id} send={send} />}
      {me && state.phase !== "lobby" && state.phase !== "final" && <Scores state={state} userId={user.id} />}
    </div>
  );
}

function Waiting({ state, host, userId, send }: { state: QuizState; host: boolean; userId: string; send: (e: string, p?: unknown) => Promise<Ack> }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl sm:p-6">
      <div className="text-center">
        <p className="text-sm text-muted">Tell the others to open Arcade Online and join with</p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(state.code).then(() => setCopied(true));
          }}
          className="mt-2 inline-flex cursor-pointer items-center gap-3 rounded-2xl bg-rose-500/12 px-5 py-2 font-mono text-5xl font-black tracking-[0.2em] text-rose-600 dark:text-rose-300"
          aria-label={`Room code ${state.code}. Copy`}
        >
          {state.code}
          {copied ? <Check className="h-6 w-6" aria-hidden="true" /> : <Copy className="h-6 w-6 opacity-50" aria-hidden="true" />}
        </button>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Players">
        {state.players.map((p) => (
          <li
            key={p.id}
            className={cn("flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center", p.id === userId ? "bg-primary/10" : "bg-surface-muted")}
          >
            <span className="relative">
              <Avatar name={p.name} />
              {p.id === state.hostId && <Crown className="absolute -top-2 -right-2 h-4 w-4 fill-amber-400 text-amber-500" aria-label="Host" />}
            </span>
            <span className="w-full truncate text-sm font-semibold">{p.name}</span>
          </li>
        ))}
      </ul>

      {host ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            label="Questions about"
            variant="pill"
            value={state.category}
            onChange={(category) => void send("ao:category", { category })}
            options={Object.entries(CATEGORY_NAMES).map(([id, label]) => ({ value: id, label }))}
            className="sm:w-56"
            size="md"
            buttonClassName="border border-border bg-surface-strong"
          />
          <Button
            variant="primary"
            size="lg"
            disabled={starting}
            onClick={async () => {
              setStarting(true);
              await send("ao:start");
              setStarting(false);
            }}
          >
            {starting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
            {state.players.length === 1 ? "Start (just me)" : `Start with ${state.players.length} players`}
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          {CATEGORY_NAMES[state.category]} · Waiting for {state.players.find((p) => p.id === state.hostId)?.name ?? "the host"} to start…
        </p>
      )}
    </section>
  );
}

function QuestionView({
  state,
  userId,
  offset,
  picked,
  onPick,
}: {
  state: QuizState;
  userId: string;
  offset: number;
  picked: number | null;
  onPick: (c: number) => void;
}) {
  const q = state.question!;
  const reveal = state.phase === "reveal" ? state.reveal : undefined;
  const [left, setLeft] = useState(q.ms);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, q.endsAt - (Date.now() + offset)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [q.endsAt, offset]);

  const mine = reveal?.results[userId];
  const answeredCount = state.players.filter((p) => p.answered).length;
  const locked = picked !== null || !!reveal || left === 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100 ease-linear",
            left < 4000 ? "bg-rose-500" : "bg-linear-to-r from-primary to-primary-2",
          )}
          style={{ width: `${reveal ? 0 : (left / q.ms) * 100}%` }}
        />
      </div>
      <div className="rounded-3xl border border-border bg-surface p-5 text-center shadow-card backdrop-blur-xl sm:p-8">
        <p className="text-xs font-semibold tracking-wider text-muted uppercase">{CATEGORY_NAMES[q.category as CategoryId] ?? q.category}</p>
        <h2 className="mt-2 text-xl font-bold sm:text-2xl">{q.text}</h2>
        <p className="mt-2 text-sm text-muted tabular-nums" aria-live="polite">
          {reveal
            ? mine
              ? mine.choice === reveal.answer
                ? `Right! +${mine.gained} 🎉`
                : "Not this time 🙈"
              : "No answer in time ⏰"
            : picked !== null
              ? `Answer locked in · ${answeredCount}/${state.players.filter((p) => p.connected).length} answered`
              : `${Math.ceil(left / 1000)} s`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.choices.map((text, i) => {
          const right = reveal && i === reveal.answer;
          const wrongPick = reveal && picked === i && i !== reveal.answer;
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onPick(i)}
              className={cn(
                "flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold text-white shadow-md transition active:scale-[0.98] disabled:cursor-default",
                CHOICES[i].color,
                reveal && !right && "opacity-35",
                picked === i && !reveal && "ring-4 ring-text/60",
                right && "ring-4 ring-emerald-300",
                wrongPick && "opacity-60",
              )}
            >
              <span className="text-2xl" aria-hidden="true">
                {CHOICES[i].shape}
              </span>
              <span className="flex-1">{text}</span>
              {right && <Check className="h-6 w-6" strokeWidth={3} aria-label="Right answer" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Scores({ state, userId }: { state: QuizState; userId: string }) {
  return (
    <ol className="flex flex-col gap-1 rounded-3xl border border-border bg-surface p-3 shadow-card backdrop-blur-xl" aria-label="Scores">
      {state.players.map((p, i) => {
        const gained = state.reveal?.results[p.id]?.gained;
        return (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm",
              p.id === userId && "bg-primary/10 font-semibold",
              !p.connected && "opacity-50",
            )}
          >
            <span className="w-5 text-center text-muted tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">
              {p.name}
              {!p.connected && " (away)"}
            </span>
            {state.phase === "question" && p.answered && <Check className="h-4 w-4 text-emerald-500" aria-label="answered" />}
            {gained !== undefined && gained > 0 && <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300">+{gained}</span>}
            <span className="w-14 text-right tabular-nums">{p.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Final({ state, host, userId, send }: { state: QuizState; host: boolean; userId: string; send: (e: string, p?: unknown) => Promise<Ack> }) {
  const [first, second, third] = state.players;
  const podium = [second, first, third].filter(Boolean);
  const heights: Record<string, string> = { [first?.id]: "h-28", [second?.id ?? "-"]: "h-20", [third?.id ?? "-"]: "h-14" };
  const medal: Record<string, string> = { [first?.id]: "🥇", [second?.id ?? "-"]: "🥈", [third?.id ?? "-"]: "🥉" };
  return (
    <section className="flex flex-col gap-5 rounded-3xl border border-border bg-surface p-5 text-center shadow-card backdrop-blur-xl sm:p-6">
      <p className="text-sm font-semibold tracking-wider text-muted uppercase">Final scores</p>
      <h2 className="text-2xl font-extrabold">{first?.id === userId ? "You won! 🏆" : `${first?.name} wins! 🏆`}</h2>
      <div className="flex items-end justify-center gap-3">
        {podium.map((p) => (
          <div key={p.id} className="flex w-24 flex-col items-center gap-1">
            <span className="text-2xl" aria-hidden="true">
              {medal[p.id]}
            </span>
            <Avatar name={p.name} />
            <span className="w-full truncate text-sm font-semibold">{p.name}</span>
            <span className="text-xs text-muted tabular-nums">{p.score} pts</span>
            <span className={cn("w-full rounded-t-xl bg-linear-to-t from-primary to-primary-2", heights[p.id])} />
          </div>
        ))}
      </div>
      {state.players.length > 3 && (
        <ol start={4} className="mx-auto w-full max-w-xs text-left text-sm">
          {state.players.slice(3).map((p, i) => (
            <li key={p.id} className="flex justify-between py-1">
              <span>
                {i + 4}. {p.name}
              </span>
              <span className="tabular-nums">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-sm text-muted">
        You got {state.players.find((p) => p.id === userId)?.correct ?? 0} of {state.rounds} right.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {host ? (
          <Button variant="primary" onClick={() => void send("ao:again")}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Play again
          </Button>
        ) : (
          <p className="text-sm text-muted">The host can start another round.</p>
        )}
        <Link href="/arcade-online/leaderboard" className={buttonClasses("secondary")}>
          <Trophy className="h-4 w-4" aria-hidden="true" /> Leaderboard
        </Link>
      </div>
    </section>
  );
}
