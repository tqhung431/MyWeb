// One sound in the mixer: tap to play or stop. While playing, it shows its own volume slider.

import { Play } from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";
import { cn } from "@/lib/cn";
import { Equalizer } from "./Equalizer";
import type { Track } from "./tracks";

import { useT } from "@/lib/i18n/I18nProvider";
type Props = {
  track: Track;
  active: boolean;
  onToggle: () => void;
  volume?: number; // 0–100, shown while active
  onVolume?: (value: number) => void;
};

export function TrackCard({ track, active, onToggle, volume = 70, onVolume }: Props) {
  const t = useT();
  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-2xl border p-3 transition",
        active
          ? "border-primary/40 bg-linear-to-br from-primary/15 to-primary-2/10"
          : "border-border bg-surface-strong/40 hover:border-primary/30 hover:bg-surface-muted",
      )}
    >
      <button
        type="button"
        aria-pressed={active}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <AppIcon icon={track.icon} accent={track.accent} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{t(track.label)}</span>{" "}
          <span className="block truncate text-xs text-muted">{t(track.description)}</span>
        </span>
        <span className={cn("shrink-0 text-primary", !active && "text-muted opacity-0 transition group-hover:opacity-100")}>
          {active ? <Equalizer /> : <Play className="h-4 w-4" aria-hidden="true" />}
        </span>
      </button>

      {active && onVolume && (
        <label className="flex items-center gap-2 px-1 text-xs text-muted">
          <input
            type="range"
            aria-label={t("{name} volume", { name: t(track.label) })}
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer"
          />
          <span className="w-8 text-right tabular-nums">{volume}%</span>
        </label>
      )}
    </div>
  );
}
