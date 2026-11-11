import { Play } from "lucide-react";
import { AppIcon } from "@/components/ui/AppIcon";
import { cn } from "@/lib/cn";
import { Equalizer } from "./Equalizer";
import type { Track } from "./tracks";

type Props = { track: Track; active: boolean; onToggle: () => void };

export function TrackCard({ track, active, onToggle }: Props) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition sm:flex-col sm:items-start sm:p-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary/40 bg-linear-to-br from-primary/15 to-primary-2/10"
          : "border-border bg-surface-strong/40 hover:border-primary/30 hover:bg-surface-muted",
      )}
    >
      <AppIcon icon={track.icon} accent={track.accent} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{track.label}</span>
        <span className="block text-sm text-muted">{track.description}</span>
      </span>
      <span className={cn("text-primary sm:self-end", !active && "text-muted opacity-0 transition group-hover:opacity-100")}>
        {active ? <Equalizer /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </span>
    </button>
  );
}
