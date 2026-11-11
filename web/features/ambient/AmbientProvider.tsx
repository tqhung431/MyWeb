"use client";

// Which sound is playing, shared by every page (the Chill page, the mini player, future apps).
// It has its own context, separate from the timer, so the timer ticking 4×/second
// doesn't re-render components that only care about sound.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as engine from "./engine";
import type { TrackName } from "./engine";

type AmbientState = {
  playing: TrackName | null;
  volume: number; // 0–100
  toggle: (name: TrackName) => void;
  stop: () => void;
  setVolume: (value: number) => void;
};

const AmbientContext = createContext<AmbientState | null>(null);

export function AmbientProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState<TrackName | null>(null);
  const [volume, setVolumeState] = useState(60);

  // Side effects (starting sound) stay outside setState: React may run updater functions twice.
  const toggle = useCallback(
    (name: TrackName) => {
      if (playing === name) {
        engine.stop();
        setPlaying(null);
      } else {
        engine.play(name);
        setPlaying(name);
      }
    },
    [playing],
  );

  const stop = useCallback(() => {
    engine.stop();
    setPlaying(null);
  }, []);

  const setVolume = useCallback((value: number) => {
    setVolumeState(value);
    engine.setVolume(value / 100);
  }, []);

  // useMemo: same object while nothing changed → consumers don't re-render for nothing.
  const value = useMemo(() => ({ playing, volume, toggle, stop, setVolume }), [playing, volume, toggle, stop, setVolume]);

  return <AmbientContext.Provider value={value}>{children}</AmbientContext.Provider>;
}

export function useAmbient(): AmbientState {
  const value = useContext(AmbientContext);
  if (!value) throw new Error("useAmbient must be used inside <AmbientProvider>");
  return value;
}
