import { Disc3, Flame, Headphones, Mic2, type LucideIcon } from "lucide-react";
import type { Genre } from "@/lib/api/music";

import { tx } from "@/lib/i18n/core";
export const GENRES: { id: Genre; label: string; hint: string; icon: LucideIcon; accent: string }[] = [
  { id: "drill", label: tx("Drill"), hint: tx("Sliding 808s, hard verses"), icon: Flame, accent: "from-zinc-700 to-red-600" },
  { id: "remix", label: tx("Remix"), hint: tx("Vinahouse, EDM, mash-ups"), icon: Disc3, accent: "from-fuchsia-500 to-orange-400" },
  { id: "pop", label: tx("Pop"), hint: tx("V-pop, ballads, R&B"), icon: Mic2, accent: "from-pink-500 to-rose-400" },
  { id: "lofi", label: tx("Lofi"), hint: tx("Chill vocals, slowed + reverb"), icon: Headphones, accent: "from-indigo-500 to-sky-400" },
];

export const genreOf = (id: Genre) => GENRES.find((g) => g.id === id)!;
