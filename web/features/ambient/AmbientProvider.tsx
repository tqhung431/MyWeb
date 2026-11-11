"use client";

// The sound mixer's state, shared by every page (the Chill page, the mini player, future apps).
// Stage 5: several tracks can play together, each with its own volume.
// It has its own context, separate from the timer, so the timer's ticking doesn't re-render it.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as engine from "./engine";
import type { TrackName } from "./engine";
import { getTrack } from "./tracks";

const DEFAULT_TRACK_VOLUME = 70; // 0–100

type AmbientState = {
  playing: TrackName[]; // in the order they were started
  volumes: Partial<Record<TrackName, number>>; // per track, 0–100
  volume: number; // master, 0–100
  toggle: (name: TrackName) => void;
  stopAll: () => void;
  setTrackVolume: (name: TrackName, value: number) => void;
  setVolume: (value: number) => void;
};

const AmbientContext = createContext<AmbientState | null>(null);

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<TrackName[]>([]);
  const [volumes, setVolumes] = useState<Partial<Record<TrackName, number>>>({});
  const [volume, setVolumeState] = useState(70);

  // Side effects (starting sound) stay outside setState: React may run updater functions twice.
  const toggle = useCallback(
    (name: TrackName) => {
      if (playing.includes(name)) {
        engine.stop(name);
        setPlaying(playing.filter((n) => n !== name));
      } else {
        // Starting a drill song stops the one already playing (they'd clash). Rain etc. keep playing.
        const replaced = getTrack(name)?.exclusive ? playing.filter((n) => getTrack(n)?.exclusive) : [];
        replaced.forEach(engine.stop);
        engine.start(name, (volumes[name] ?? DEFAULT_TRACK_VOLUME) / 100);
        setPlaying([...playing.filter((n) => !replaced.includes(n)), name]);
      }
    },
    [playing, volumes],
  );

  const stopAll = useCallback(() => {
    engine.stopAll();
    setPlaying([]);
  }, []);

  const setTrackVolume = useCallback((name: TrackName, value: number) => {
    setVolumes((v) => ({ ...v, [name]: value }));
    engine.setTrackVolume(name, value / 100);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    engine.setVolume(value / 100);
  }, []);

  // useMemo: same object while nothing changed → consumers don't re-render for nothing.
  const value = useMemo(
    () => ({ playing, volumes, volume, toggle, stopAll, setTrackVolume, setVolume }),
    [playing, volumes, volume, toggle, stopAll, setTrackVolume, setVolume],
  );

  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientState {
  const value = useContext(AmbientContext);
  if (!value) throw new Error("useAmbient must be used inside <AmbientProvider>");
  return value;
}

export { DEFAULT_TRACK_VOLUME };
