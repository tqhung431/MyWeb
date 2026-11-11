"use client";

// The mixer: pick any sounds, play them together, set each one's volume.

import { Square, Volume1, Volume2, VolumeX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DEFAULT_TRACK_VOLUME, useAmbient } from "./AmbientProvider";
import { TrackCard } from "./TrackCard";
import { CATEGORIES, getTrack, TRACKS, type Category } from "./tracks";

export function SoundPanel() {
  const { playing, toggle, stopAll, volumes, setTrackVolume, volume, setVolume } = useAmbient();
  const [category, setCategory] = useState<Category>("music");
  const VolumeIcon = volume === 0 ? VolumeX : volume < 50 ? Volume1 : Volume2;
  const nowPlaying = playing.map((n) => getTrack(n)?.label).join(" + ");

  return (
    <Card aria-labelledby="sound-title">
      <CardHeader
        id="sound-title"
        title="Soundscape"
        subtitle={playing.length ? `Playing: ${nowPlaying}` : "Mix any sounds together. All made live in your browser."}
        action={
          playing.length > 0 && (
            <Button variant="secondary" size="sm" onClick={stopAll}>
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Stop all
            </Button>
          )
        }
      />

      <div className="mb-4">
        <SegmentedControl
          label="Sound type"
          options={CATEGORIES.map((c) => ({
            value: c.id,
            label: `${c.label} ${countIn(c.id, playing) ? `· ${countIn(c.id, playing)}` : ""}`.trim(),
          }))}
          value={category}
          onChange={setCategory}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Sounds">
        {TRACKS.filter((t) => t.category === category).map((track) => (
          <TrackCard
            key={track.name}
            track={track}
            active={playing.includes(track.name)}
            onToggle={() => toggle(track.name)}
            volume={volumes[track.name] ?? DEFAULT_TRACK_VOLUME}
            onVolume={(v) => setTrackVolume(track.name, v)}
          />
        ))}
      </div>

      <label htmlFor="volume" className="mt-5 flex items-center gap-3 text-sm text-muted">
        <VolumeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="shrink-0 font-semibold">Master</span>
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

function countIn(category: Category, playing: string[]): number {
  return TRACKS.filter((t) => t.category === category && playing.includes(t.name)).length;
}
