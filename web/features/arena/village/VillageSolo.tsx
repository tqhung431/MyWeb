"use client";

// Stage 24 · Giữ Làng solo: the rules run right here in your browser, 20 steps a second (×2 speed = bigger steps).
// The game is saved between waves (in this browser, and in Nook if you have a name) so you can carry on later.
// At the end, your result goes on the map's leaderboard.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { useMe } from "@/features/me/MeProvider";
import { saveVillageScore } from "@/lib/api/arena";
import { deleteSave, putSave } from "@/lib/api/games";
import { useT } from "@/lib/i18n/I18nProvider";
import { MAP_NAMES } from "./names";
import { ViewFeed, VillageGame } from "./VillageGame";
import * as V from "./village";

export const SAVE_KEY = "nook.village.save";

export function readLocalSave(): V.VillageSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as V.VillageSave) : null;
  } catch {
    return null;
  }
}

export function VillageSolo({ map, endless, resume }: { map: V.MapId; endless: boolean; resume: boolean }) {
  const t = useT();
  const { user } = useMe();
  const player: V.Player = { id: user?.id ?? "me", name: user?.name ?? "", side: null };
  const game = useRef<V.VillageGame | null>(null);
  const feed = useRef(new ViewFeed());
  const [speed, setSpeed] = useState<1 | 2>(1);
  const [paused, setPaused] = useState(false);
  const [round, setRound] = useState(0); // "play again" starts a new game
  const control = useRef({ speed: 1 as 1 | 2, paused: false });
  control.current = { speed, paused };

  useEffect(() => {
    const saved = resume ? readLocalSave() : null;
    const g = saved ? V.loadSave(saved, player) : V.newVillage(map, [player], endless);
    game.current = g;
    feed.current.push(V.villageView(g));
    let savedAt = g.cleared;
    let reported = false;
    const id = setInterval(() => {
      if (!control.current.paused) V.stepVillage(g, 50 * control.current.speed);
      feed.current.push(V.villageView(g));
      // Save after each wave
      if (g.phase === "build" && g.cleared !== savedAt) {
        savedAt = g.cleared;
        const save = V.saveOf(g);
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch {}
        if (user) void putSave("village", { version: 1, summary: `${t(MAP_NAMES[g.map])} · ${t("wave {n}", { n: g.cleared })}`, data: save as unknown as Record<string, unknown> }).catch(() => {});
      }
      // The end: forget the save, report the result
      if ((g.phase === "won" || g.phase === "lost") && !reported) {
        reported = true;
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch {}
        if (user) {
          void deleteSave("village").catch(() => {});
          void saveVillageScore({ map: g.map, waves: g.cleared, rice: g.rice, won: g.phase === "won", endless: g.endless }).catch(() => {});
        }
      }
    }, 50);
    return () => clearInterval(id);
  }, [round]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <VillageGame
      key={round}
      feed={feed.current}
      myId={player.id}
      act={async (action) => {
        if (!game.current) return "Not ready";
        const err = V.act(game.current, player.id, action);
        feed.current.push(V.villageView(game.current));
        return err;
      }}
      speed={speed}
      paused={paused}
      canControl
      setSpeed={setSpeed}
      setPaused={setPaused}
      endActions={
        <>
          <Button variant="light" onClick={() => setRound((r) => r + 1)}>
            {t("Play again")}
          </Button>
          <Link href="/arena/village" className={buttonClasses("secondary", "md")}>
            {t("Back")}
          </Link>
        </>
      }
    />
  );
}
