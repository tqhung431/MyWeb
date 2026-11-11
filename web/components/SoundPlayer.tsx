"use client"; // handles clicks → runs in the browser

import type { TrackName } from "@/lib/ambient";
import { useChill } from "./ChillProvider";
import { PillButton } from "./PillButton";

const TRACKS: { name: TrackName; icon: string; label: string }[] = [
  { name: "rain", icon: "🌧️", label: "Rain" },
  { name: "waves", icon: "🌊", label: "Waves" },
  { name: "keys", icon: "🎹", label: "Lo-fi keys" },
];

export function SoundPlayer() {
  // In Stage 1 we read state back from the DOM. Now React state is the single source of truth.
  const { playing, toggleTrack, volume, setVolume } = useChill();
  const current = TRACKS.find((t) => t.name === playing);

  return (
    <section className="card" aria-labelledby="sound-title">
      <h2 id="sound-title">Sounds</h2>
      <p className="hint">Made live in your browser with the Web Audio API.</p>

      <div className="tracks" role="group" aria-label="Choose a sound">
        {TRACKS.map((t) => (
          <PillButton key={t.name} className="track" pressed={playing === t.name} onClick={() => toggleTrack(t.name)}>
            <span aria-hidden="true">{t.icon}</span> {t.label}
          </PillButton>
        ))}
      </div>

      <label className="volume" htmlFor="volume">
        Volume
        <input
          id="volume"
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
        />
      </label>

      <p className="now-playing" aria-live="polite">
        {current ? `Now playing: ${current.icon} ${current.label}` : "Nothing playing"}
      </p>
    </section>
  );
}
