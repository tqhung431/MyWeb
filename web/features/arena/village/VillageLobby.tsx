"use client";

// Stage 24 · Giữ Làng's front page: play alone (in your browser, saved between waves) or with a friend (on the game
// server), and the best scores on each map.

import { Plus, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { useMe } from "@/features/me/MeProvider";
import { getVillageBoard, type OpenVillageRoom, type VillageBoardRow } from "@/lib/api/arena";
import { getSave } from "@/lib/api/games";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { MAP_NAMES, TOWER_INFO } from "./names";
import { readLocalSave, SAVE_KEY } from "./VillageSolo";
import { MAP_IDS, TOWER_KINDS, type MapId, type VillageSave } from "./village";

const MAP_ART: Record<MapId, string> = { riverside: "from-emerald-500 to-sky-600", terraces: "from-lime-500 to-emerald-700", festival: "from-indigo-900 to-rose-700" };

export function VillageLobby() {
  const t = useT();
  const { user } = useMe();
  const { connected, ask } = useArena();
  const router = useRouter();
  const [map, setMap] = useState<MapId>("riverside");
  const [endless, setEndless] = useState(false);
  const [save, setSave] = useState<VillageSave | null>(null);
  const [rooms, setRooms] = useState<OpenVillageRoom[]>([]);
  const [board, setBoard] = useState<VillageBoardRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const local = readLocalSave();
    if (local) setSave(local);
    else if (user)
      getSave("village").then(
        (s) => {
          const data = s.data as VillageSave;
          try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
          } catch {}
          setSave(data);
        },
        () => {},
      );
  }, [user]);
  useEffect(() => {
    getVillageBoard(map).then(setBoard, () => setBoard([]));
  }, [map]);
  const load = useCallback(() => void ask("arena:rooms", { kind: "village" }).then((a) => a.ok && setRooms(a.rooms as OpenVillageRoom[])), [ask]);
  useEffect(() => {
    if (connected) load();
  }, [connected, load]);
  useArenaEvent<{ kind: string }>("arena:rooms", (e) => e.kind === "village" && load());

  const coop = async () => {
    setError("");
    const a = await ask("village:create", { map });
    if (a.ok && a.code) router.push(`/arena/village/${a.code}`);
    else setError(t(a.error ?? "That didn't work"));
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-800 via-teal-700 to-amber-600 p-6 text-white shadow-card sm:p-8">
          <p className="pointer-events-none absolute -right-2 -bottom-3 text-6xl opacity-90 sm:text-7xl" aria-hidden="true">
            🏮🌾
          </p>
          <p className="text-sm font-semibold tracking-wide text-amber-200 uppercase">{t("Tower defense · alone or with a friend")}</p>
          <h2 className="mt-1 text-3xl font-extrabold">{t("Keep the Village")}</h2>
          <p className="mt-1 max-w-[70%] text-white/90 sm:max-w-sm">
            {t("Mischievous spirits are coming for the rice. Build defenders along the paths and keep the granary full for 30 waves.")}
          </p>
          {save && (
            <Link href="/arena/village/solo?continue=1" className={buttonClasses("light", "md", "mt-5")}>
              {t("Continue: {map}, wave {n}", { map: t(MAP_NAMES[save.map]), n: save.cleared + 1 })}
            </Link>
          )}
        </section>

        <Card>
          <CardHeader title={t("Pick a map")} />
          <div role="radiogroup" aria-label={t("Map")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MAP_IDS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={map === m}
                onClick={() => setMap(m)}
                className={cn(
                  "cursor-pointer rounded-2xl bg-linear-to-br p-4 text-left text-white shadow-sm ring-offset-2 ring-offset-background transition",
                  MAP_ART[m],
                  map === m ? "ring-4 ring-primary" : "opacity-80 hover:opacity-100",
                )}
              >
                <span className="block text-lg font-extrabold">{t(MAP_NAMES[m])}</span>
                <span className="text-xs text-white/85">{t("30 waves · two paths")}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Mode"
              value={endless ? "endless" : "normal"}
              onChange={(v) => setEndless(v === "endless")}
              options={[
                { value: "normal", label: "30 waves" },
                { value: "endless", label: "Endless" },
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/arena/village/solo?map=${map}${endless ? "&endless=1" : ""}`} className={buttonClasses("primary", "md")}>
              {t("Play alone")}
            </Link>
            {user && (
              <Button variant="secondary" onClick={coop} disabled={!connected}>
                <Users className="h-4 w-4" aria-hidden="true" /> {t("Play with a friend")}
              </Button>
            )}
          </div>
          {error && <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{error}</p>}
          {rooms.length > 0 && (
            <>
              <h3 className="mt-5 mb-2 text-sm font-bold">{t("Friends waiting for a partner")}</h3>
              <ul className="flex flex-col gap-2">
                {rooms.map((r) => (
                  <li key={r.code}>
                    <Link href={`/arena/village/${r.code}`} className="flex items-center gap-3 rounded-2xl border border-border p-3 transition hover:border-primary/40">
                      <span className="rounded-xl bg-emerald-500/12 px-2.5 py-1.5 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">{r.code}</span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-semibold">{r.host ?? "…"}</span>
                        <span className="text-xs text-muted">
                          {t(MAP_NAMES[r.map as MapId] ?? r.map)} · {r.status === "waiting" ? t("Waiting to start") : t("Playing")}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 text-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title={t("The defenders")} subtitle={t("Each can be upgraded twice, in one of two ways.")} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOWER_KINDS.map((k) => (
              <li key={k} className="flex gap-2 text-sm">
                <span className="text-xl" aria-hidden="true">
                  {TOWER_INFO[k].emoji}
                </span>
                <span>
                  <span className="font-bold">{t(TOWER_INFO[k].name)}</span>
                  <span className="block text-muted">
                    {t(TOWER_INFO[k].about)} · {t(TOWER_INFO[k].branches.a)} / {t(TOWER_INFO[k].branches.b)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title={t("Best on {map}", { map: t(MAP_NAMES[map]) })} />
        {board.length === 0 ? (
          <p className="text-sm text-muted">{t("No scores yet. Be the first!")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.map((r) => (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.me && "bg-primary/10")}>
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank === 1 ? <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-label="1" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">{t("wave {n}", { n: r.waves })}</span>
                <span className="w-12 text-right font-mono text-sm font-bold">{r.score}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
