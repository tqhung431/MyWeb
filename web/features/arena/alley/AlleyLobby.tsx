"use client";

// Stage 23 · Ngõ Pháo's front page: start a room, join one by code, see who's winning.

import { Bot, LogIn, Plus, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import { getAlleyBoard, type AlleyBoardRow, type OpenAlleyRoom } from "@/lib/api/arena";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { LanternHead } from "./LanternHead";
import { MAP_NAMES } from "./names";

export function AlleyLobby() {
  const t = useT();
  const { user } = useMe();
  const { connected, ask } = useArena();
  const router = useRouter();
  const [rooms, setRooms] = useState<OpenAlleyRoom[]>([]);
  const [board, setBoard] = useState<AlleyBoardRow[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => void ask("arena:rooms", { kind: "alley" }).then((a) => a.ok && setRooms(a.rooms as OpenAlleyRoom[])), [ask]);
  useEffect(() => {
    if (connected) load();
  }, [connected, load]);
  useArenaEvent<{ kind: string }>("arena:rooms", (e) => e.kind === "alley" && load());
  useEffect(() => {
    getAlleyBoard().then(setBoard, () => {});
  }, []);

  const create = async () => {
    setBusy(true);
    setError("");
    const a = await ask("alley:create");
    setBusy(false);
    if (a.ok && a.code) router.push(`/arena/alley/${a.code}`);
    else setError(a.error ?? t("That didn't work"));
  };
  const join = (e: FormEvent) => {
    e.preventDefault();
    if (code.length === 4) router.push(`/arena/alley/${code}`);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-red-900 via-rose-800 to-amber-700 p-6 text-white shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-2 -bottom-3 flex items-end gap-1" aria-hidden="true">
            <LanternHead color={0} hat={1} size={84} />
            <LanternHead color={2} hat={2} size={64} />
            <LanternHead color={1} hat={4} size={72} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">{t("Firecracker Alley")}</p>
          <h2 className="mt-1 text-3xl font-extrabold">Ngõ Pháo</h2>
          <p className="mt-1 max-w-sm text-white/90">{t("Drop firecrackers, break crates, grab power-ups. Last lantern-head standing wins the round; first to 3 wins the match.")}</p>
          {user && (
            <Button variant="light" size="md" className="mt-5" onClick={create} disabled={!connected || busy}>
              <Plus className="h-4 w-4" aria-hidden="true" /> {t("Start a room")}
            </Button>
          )}
          {error && <p className="mt-2 text-sm text-white">{error}</p>}
          {!connected && <p className="mt-2 text-sm text-white/80">{t("Connecting to the game server…")}</p>}
        </section>

        {!user && <NeedName why={t("Pick a name so the others know who knocked them out.")} />}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title={t("Join with a code")} subtitle={t("Got a code from a friend? Type the 4 letters.")} />
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
                aria-label={t("Room code")}
                autoCapitalize="characters"
                className="h-12 w-32 rounded-2xl border border-border bg-surface-strong/70 text-center text-2xl font-bold tracking-[0.3em] uppercase focus:border-primary focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={code.length !== 4}>
                <LogIn className="h-4 w-4" aria-hidden="true" /> {t("Join")}
              </Button>
            </form>
            <h3 className="mt-5 mb-2 text-sm font-bold">{t("Open rooms")}</h3>
            {rooms.length === 0 ? (
              <p className="text-sm text-muted">{t("No rooms right now. Start one and tell the others the code!")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <Link href={`/arena/alley/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-primary/40">
                      <span className="rounded-xl bg-rose-500/12 px-2.5 py-1.5 font-mono text-sm font-bold text-rose-600 dark:text-rose-300">{r.code}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold">{r.host ?? "…"}</span>
                        <span className="text-xs text-muted">
                          {t(MAP_NAMES[r.map] ?? r.map)} · {r.status === "waiting" ? t("Waiting to start") : t("Playing")}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                        <Users className="h-3.5 w-3.5" aria-hidden="true" /> {r.players}
                        {r.bots > 0 && (
                          <>
                            <Bot className="ml-1 h-3.5 w-3.5" aria-hidden="true" /> {r.bots}
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("How to play")} />
            <ul className="flex flex-col gap-2 text-sm">
              <li>🧨 {t("Drop a firecracker: it pops after 2.5 seconds in a cross of sparks.")}</li>
              <li>📦 {t("Sparks break bamboo crates. Some hide power-ups.")}</li>
              <li>👻 {t("Knocked out? You become a ghost and can tease the others with a tiny cracker.")}</li>
              <li>🦁 {t("A lion dance passes once a round and pushes people aside.")}</li>
              <li>🏮 {t("After 90 seconds, lanterns fill the alley from the edges.")}</li>
              <li>⌨️ {t("Arrows or WASD to walk, Space to drop. On a phone: the joystick and the big button.")}</li>
            </ul>
          </Card>
        </div>
      </div>

      <Card className="self-start">
        <CardHeader title={t("Most matches won")} />
        {board.length === 0 ? (
          <p className="text-sm text-muted">{t("Nobody has won a match yet.")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.map((r) => (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.me && "bg-primary/10")}>
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank === 1 ? <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-label="1" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{t("{n} played", { n: r.games })}</span>
                <span className="w-8 text-right font-mono text-sm font-bold">{r.wins}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
