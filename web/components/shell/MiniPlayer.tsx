"use client";

// A small floating bar that shows the sound and timer on every page except Chill Corner itself.
// It reads the SAME providers as the Chill page, which is why it stays in sync.

import { Pause, Play, Square } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { useAmbient } from "@/features/ambient/AmbientProvider";
import { Equalizer } from "@/features/ambient/Equalizer";
import { getTrack } from "@/features/ambient/tracks";
import { useFocus } from "@/features/focus/FocusProvider";
import { MODES } from "@/features/focus/logic";
import { useMusic } from "@/features/music/MusicProvider";
import { getApp } from "@/lib/apps";
import { cn } from "@/lib/cn";

export function MiniPlayer() {
  const pathname = usePathname();
  const ambient = useAmbient();
  const focus = useFocus();
  const music = useMusic();

  const tracks = ambient.playing.map((n) => getTrack(n)).filter((t) => t !== undefined);
  const track = tracks[0]; // the first one sets the icon
  const visible = (track || focus.active) && pathname !== "/chill";
  if (!visible) return null;

  const chill = getApp("chill");

  return (
    <section
      aria-label="Now playing"
      className={cn(
        "fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-border bg-surface-strong/90 p-2.5 pr-3 shadow-card backdrop-blur-xl lg:bottom-6 lg:left-[calc(17rem+1.5rem)]",
        // With the music player open: hidden on phones (no room), moved left on desktop
        music.current && "hidden lg:flex lg:right-[calc(24rem+3rem)] lg:mx-0",
      )}
    >
      <Link
        href="/chill"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <AppIcon icon={track?.icon ?? chill.icon} accent={track?.accent ?? chill.accent} size="md" />
        <span className="min-w-0">
          <span className="flex items-center gap-2 truncate text-sm font-semibold">
            {track ? (tracks.length > 1 ? `${track.label} +${tracks.length - 1}` : track.label) : "Silence"}
            {track && (
              <span className="text-primary">
                <Equalizer />
              </span>
            )}
          </span>
          {focus.active && (
            <span className="block truncate text-xs text-muted tabular-nums">
              {MODES[focus.mode].label} · {focus.time} {focus.running ? "" : "(paused)"}
            </span>
          )}
        </span>
      </Link>

      {focus.active && (
        <Button
          variant="primary"
          size="icon"
          className="h-10 w-10"
          onClick={focus.running ? focus.pause : focus.start}
          aria-label={focus.running ? "Pause timer" : "Resume timer"}
        >
          {focus.running ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </Button>
      )}
      {track && (
        <Button variant="secondary" size="icon" className="h-10 w-10" onClick={ambient.stopAll} aria-label="Stop all sounds">
          <Square className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </section>
  );
}
