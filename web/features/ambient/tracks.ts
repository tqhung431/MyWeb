import type { LucideIcon } from "lucide-react";
import { CloudRain, Piano, Waves } from "lucide-react";
import type { TrackName } from "./engine";

export type Track = { name: TrackName; label: string; description: string; icon: LucideIcon; accent: string };

export const TRACKS: Track[] = [
  {
    name: "rain",
    label: "Rain",
    description: "Soft rain on a window",
    icon: CloudRain,
    accent: "from-sky-400 to-indigo-500",
  },
  {
    name: "waves",
    label: "Waves",
    description: "Slow ocean swell",
    icon: Waves,
    accent: "from-cyan-400 to-teal-500",
  },
  {
    name: "keys",
    label: "Lo-fi keys",
    description: "Warm chords, tape hiss",
    icon: Piano,
    accent: "from-violet-500 to-fuchsia-500",
  },
];

export function getTrack(name: TrackName | null): Track | undefined {
  return TRACKS.find((t) => t.name === name);
}
