"use client";

// Holds the Game and saves it.
//
//   const { game, update } = useGame();
//   const result = update((g) => act(g, { type: "wait" }));
//
// update() copies the game, lets the rules change the copy, then shows and saves it.
// Saves go to this browser at once, and (if you picked a name) to Nook's database a few seconds later,
// so you can carry on from another device. When both exist, the newer one wins.

import { useCallback, useEffect, useRef, useState } from "react";
import { useMe } from "@/features/me/MeProvider";
import { deleteSave, getSave, putSave } from "@/lib/api/games";
import { realmName } from "../logic/player";
import { clearLocal, loadLocal, newer, parseSave, saveLocal } from "../logic/save";
import { SAVE_VERSION, type Game } from "../logic/types";

export type CloudState = "guest" | "saving" | "saved" | "offline";
const CLOUD_DELAY_MS = 4000;

export function useGame() {
  const { user } = useMe();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloud, setCloud] = useState<CloudState>(user ? "saved" : "guest");
  const current = useRef<Game | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userId = user?.id ?? null;

  // Load: this browser's save and the cloud save, whichever is newer
  useEffect(() => {
    let cancelled = false;
    const local = loadLocal();
    const done = (g: Game | null) => {
      if (cancelled) return;
      current.current = g;
      setGame(g);
      setLoading(false);
    };
    if (!userId) {
      setCloud("guest");
      done(local);
      return;
    }
    getSave("van-lo")
      .then((s) => parseSave(s.data))
      .catch(() => null)
      .then((remote) => done(newer(local, remote)));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const pushCloud = useCallback(async () => {
    timer.current = null;
    const g = current.current;
    if (!g || !userId) return;
    setCloud("saving");
    try {
      await putSave("van-lo", { version: SAVE_VERSION, summary: realmName(g.player, g.lang), data: g });
      setCloud("saved");
    } catch {
      setCloud("offline");
    }
  }, [userId]);

  const persist = useCallback(
    (g: Game, now = false) => {
      saveLocal(g);
      if (!userId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(pushCloud, now ? 0 : CLOUD_DELAY_MS);
    },
    [pushCloud, userId],
  );

  // Save to the cloud when you leave the page
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && timer.current) {
        clearTimeout(timer.current);
        void pushCloud();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pushCloud]);

  const update = useCallback(
    <T>(change: (g: Game) => T, opts: { saveNow?: boolean } = {}): T | undefined => {
      if (!current.current) return undefined;
      const g = structuredClone(current.current);
      const out = change(g);
      g.updatedAt = Date.now();
      current.current = g;
      setGame(g);
      persist(g, opts.saveNow);
      return out;
    },
    [persist],
  );

  const start = useCallback(
    (g: Game) => {
      current.current = g;
      setGame(g);
      persist(g, true);
    },
    [persist],
  );

  const reset = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    clearLocal();
    current.current = null;
    setGame(null);
    if (userId) await deleteSave("van-lo").catch(() => {});
  }, [userId]);

  return { game, loading, cloud, update, start, reset };
}
