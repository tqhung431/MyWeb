import type { LucideIcon } from "lucide-react";
import { AudioLines, AudioWaveform, Bird, CloudRain, Droplets, Flame, Headphones, MoonStar, Music2, Piano, Waves } from "lucide-react";
import type { TrackName } from "./engine";

export type Category = "music" | "nature";

export type Track = {
  name: TrackName;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string; // gradient for the icon tile
  category: Category;
};

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "music", label: "Music" },
  { id: "nature", label: "Nature & noise" },
];

export const TRACKS: Track[] = [
  // Music: all composed by code, live in your browser
  { name: "lofi-beats", label: "Lo-fi beats", description: "Mellow drums, bass and jazzy keys", icon: Headphones, accent: "from-fuchsia-500 to-rose-500", category: "music" },
  { name: "keys", label: "Lo-fi keys", description: "Warm chords, tape hiss", icon: Piano, accent: "from-violet-500 to-fuchsia-500", category: "music" },
  { name: "night-piano", label: "Night piano", description: "Slow chords and a wandering melody", icon: MoonStar, accent: "from-indigo-500 to-violet-600", category: "music" },
  { name: "music-box", label: "Music box", description: "Gentle bells, like a wind-up toy", icon: Music2, accent: "from-amber-400 to-pink-500", category: "music" },
  { name: "ambient-pad", label: "Ambient pad", description: "Long soft chords that drift", icon: AudioWaveform, accent: "from-sky-400 to-violet-500", category: "music" },
  // Nature & noise
  { name: "rain", label: "Rain", description: "Soft rain on a window", icon: CloudRain, accent: "from-sky-400 to-indigo-500", category: "nature" },
  { name: "waves", label: "Waves", description: "Slow ocean swell", icon: Waves, accent: "from-cyan-400 to-teal-500", category: "nature" },
  { name: "fireplace", label: "Fireplace", description: "Crackling logs", icon: Flame, accent: "from-orange-400 to-red-500", category: "nature" },
  { name: "forest", label: "Forest", description: "Wind in the trees, birds", icon: Bird, accent: "from-lime-400 to-emerald-600", category: "nature" },
  { name: "stream", label: "Stream", description: "Babbling water", icon: Droplets, accent: "from-teal-400 to-sky-500", category: "nature" },
  { name: "brown-noise", label: "Brown noise", description: "Deep, steady, blocks chatter", icon: AudioLines, accent: "from-stone-400 to-stone-600", category: "nature" },
];

export function getTrack(name: TrackName | null | undefined): Track | undefined {
  return TRACKS.find((t) => t.name === name);
}
