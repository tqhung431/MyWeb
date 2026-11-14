"use client";

// Stage 24 · Giữ Làng co-op: two people, one map. Each builds on their own side (path 1 or path 2); the spirits from
// both entrances meet at the granary. The rules run on the game server; this page draws what it sends.

import { Check, Copy, Crown, Loader2, Play, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useArena, useArenaEvent, useArenaRoom } from "@/features/arena/ArenaProvider";
import { NeedName } from "@/features/arena/NeedName";
import { useMe } from "@/features/me/MeProvider";
import type { VillageRoomState } from "@/lib/api/arena";
import { useT } from "@/lib/i18n/I18nProvider";
import { MAP_NAMES } from "./names";
import { ViewFeed, VillageGame } from "./VillageGame";
import { MAP_IDS, type MapId, type VillageView } from "./village";

export function VillageRoom({ code }: { code: string }) {
  const t = useT();
  const { user } = useMe();
  const { ask } = useArena();
  const [room, setRoom] = useState<VillageRoomState | null>(null);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const feed = useRef(new ViewFeed());

  useArenaRoom(code, setError);
  useArenaEvent<VillageRoomState>("room:state", (s) => {
    if (s.code !== code || s.kind !== "village") return;
    setRoom(s);
    if (!s.village.playing) {
      setStarted(false);
      feed.current = new ViewFeed();
    }
  });
  useArenaEvent<VillageView & { code: string }>("village:tick", (v) => {
    if (v.code !== code) return;
    feed.current.push(v);
    if (!started) setStarted(true);
  });

  if (!user && !room) return <NeedName why={t("Pick a name to play. Without one you can only watch.")} />;
  if (!room) {
    return (
      <div className="flex items-center gap-2 text-muted">
        {error ? (
          <>
            <X className="h-4 w-4" aria-hidden="true" /> {error}{" "}
            <Link href="/arena/village" className="font-semibold text-primary">
              {t("Back")}
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t("Joining…")}
          </>
        )}
      </div>
    );
  }

  const L = room.village;
  const isHost = user?.id === L.hostId;
  const send = async (event: string, payload: object = {}) => {
    const a = await ask(event, { code, ...payload });
    setError(a.ok ? "" : t(a.error ?? "That didn't work"));
    return a.ok ? null : (a.error ?? "That didn't work");
  };

  if (L.playing && started) {
    return (
      <VillageGame
        feed={feed.current}
        myId={L.seats.some((s) => s.id === user?.id) ? (user?.id ?? null) : null}
        act={(action) => send("village:act", { action })}
        speed={L.speed}
        paused={L.paused}
        canControl={isHost}
        setSpeed={(speed) => void send("village:speed", { speed })}
        setPaused={(paused) => void send("village:speed", { paused })}
        endActions={
          <>
            {isHost && (
              <Button variant="light" onClick={() => send("village:again")}>
                {t("Back to the room")}
              </Button>
            )}
            <Link href="/arena/village" className={buttonClasses("secondary", "md")}>
              {t("Leave")}
            </Link>
          </>
        }
      />
    );
  }
  if (L.playing) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;

  const copy = async () => {
    await navigator.clipboard?.writeText(`${location.origin}/arena/village/${code}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-3xl bg-linear-to-br from-emerald-800 via-teal-700 to-amber-600 p-5 text-white shadow-card sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-amber-200 uppercase">{t("Keep the Village")} · {t("Room code")}</p>
            <p className="font-mono text-3xl font-extrabold tracking-[0.25em]">{code}</p>
          </div>
          <Button variant="light" size="sm" onClick={copy}>
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />} {copied ? t("Copied") : t("Invite")}
          </Button>
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => {
            const s = L.seats[i];
            return (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-white/15 p-3">
                {s ? (
                  <>
                    <Avatar name={s.name} size="md" />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 truncate font-bold">
                        {s.id === L.hostId && <Crown className="h-4 w-4 shrink-0 text-amber-300" aria-label={t("Host")} />} {s.name}
                      </p>
                      <p className="text-xs text-white/80">{i === 0 ? t("Guards the first path") : t("Guards the second path")}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-white/80">{t("Waiting for a friend… (or play this map alone)")}</p>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {isHost ? (
            <Button variant="light" size="md" onClick={() => send("village:start")}>
              <Play className="h-4 w-4" aria-hidden="true" /> {L.seats.length > 1 ? t("Start together") : t("Start alone")}
            </Button>
          ) : (
            <p className="text-sm text-white/85">{t("The host starts the game.")}</p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-amber-100">
            {error}
          </p>
        )}
      </section>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title={t("Game settings")} subtitle={isHost ? t("You're the host.") : t("The host chooses.")} />
          <div className="flex flex-col gap-4">
            <Select<MapId>
              label={t("Map")}
              showLabel
              value={L.map}
              disabled={!isHost}
              onChange={(map) => send("village:settings", { map })}
              options={MAP_IDS.map((m) => ({ value: m, label: t(MAP_NAMES[m]) }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={L.endless} disabled={!isHost} onChange={(e) => send("village:settings", { endless: e.target.checked })} className="h-4 w-4" />
              {t("Endless mode (no last wave)")}
            </label>
          </div>
        </Card>
        <Link href="/arena/village" className="px-1 text-sm font-semibold text-primary">
          ← {t("Leave the room")}
        </Link>
      </div>
    </div>
  );
}
