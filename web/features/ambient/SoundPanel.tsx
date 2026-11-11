"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAmbient } from "./AmbientProvider";
import { TrackCard } from "./TrackCard";
import { TRACKS } from "./tracks";

export function SoundPanel() {
  const { playing, toggle, volume, setVolume } = useAmbient();
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;

  return (
    <Card aria-labelledby="sound-title">
      <CardHeader id="sound-title" title="Soundscape" subtitle="Generated live in your browser. No recordings." />

      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Choose a sound">
        {TRACKS.map((track) => (
          <TrackCard key={track.name} track={track} active={playing === track.name} onToggle={() => toggle(track.name)} />
        ))}
      </div>

      <label htmlFor="volume" className="mt-5 flex items-center gap-3 text-sm text-muted">
        <VolumeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="sr-only">Volume</span>
        <input
          id="volume"
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer"
        />
        <span className="w-10 text-right tabular-nums">{volume}%</span>
      </label>
    </Card>
  );
}
