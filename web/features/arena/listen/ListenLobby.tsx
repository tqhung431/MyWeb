"use client";

// Stage 22: Listen Together's front page: start a room or join one. In a room, everyone hears the same song at the
// same second, from Nook's own music library.

import { Headphones, LogIn, Music2, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import type { OpenListenRoom } from "@/lib/api/arena";
import { useT } from "@/lib/i18n/I18nProvider";

export function ListenLobby() {
  const t = useT();
  const { user } = useMe();
  const { connected, ask } = useArena();
  const router = useRouter();
  const [rooms, setRooms] = useState<OpenListenRoom[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => void ask("arena:rooms", { kind: "listen" }).then((a) => a.ok && setRooms(a.rooms as OpenListenRoom[])), [ask]);
  useEffect(() => {
    if (connected) load();
  }, [connected, load]);
  useArenaEvent<{ kind: string }>("arena:rooms", (e) => e.kind === "listen" && load());

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const a = await ask("listen:create", { name: name.trim() || t("{name}'s room", { name: user?.name ?? "" }) });
    if (a.ok && a.code) router.push(`/arena/listen/${a.code}`);
    else setError(a.error ?? t("That didn't work"));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-fuchsia-500 via-rose-500 to-orange-400 p-6 text-white shadow-card sm:p-8">
          <Headphones className="pointer-events-none absolute -right-4 -bottom-6 h-40 w-40 rotate-[-12deg] opacity-20" aria-hidden="true" />
          <h2 className="relative text-2xl font-extrabold sm:text-3xl">{t("Listen Together")}</h2>
          <p className="relative mt-1 max-w-md text-white/90">{t("Everyone in the room hears the same song at the same moment. Add songs, vote what plays next, react.")}</p>
          {user && (
            <form onSubmit={create} className="relative mt-5 flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder={t("Room name, e.g. Friday night")}
                aria-label={t("Room name")}
                className="h-11 min-w-0 flex-1 rounded-full bg-white/20 px-4 text-white placeholder:text-white/70 backdrop-blur focus:bg-white/30 focus:outline-none sm:max-w-xs"
              />
              <Button type="submit" variant="light" size="md" disabled={!connected}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t("Start a room")}
              </Button>
            </form>
          )}
          {error && <p className="relative mt-2 text-sm text-white">{error}</p>}
          {!connected && <p className="relative mt-2 text-sm text-white/80">{t("Connecting to the game server…")}</p>}
        </section>
        {!user && <NeedName why={t("Pick a name so the room knows who added which song.")} />}
        <Card>
          <CardHeader title={t("Join with a code")} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 4) router.push(`/arena/listen/${code}`);
            }}
            className="flex gap-2"
          >
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
        </Card>
      </div>
      <Card className="self-start">
        <CardHeader title={t("Rooms now")} subtitle={t("Updates live")} />
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">{t("No rooms right now. Start one!")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rooms.map((r) => (
              <li key={r.code}>
                <Link href={`/arena/listen/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-primary/40">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-linear-to-br from-fuchsia-500 to-orange-400 text-white">
                    <Music2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span className="block truncate text-xs text-muted">{r.playing ? t("Playing: {title}", { title: r.playing }) : t("Quiet")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" /> {r.people}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
