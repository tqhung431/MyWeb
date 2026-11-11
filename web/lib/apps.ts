// The app registry: ONE list of every app in MyWeb.
// The sidebar, the phone tab bar, the Home grid and each app's sub-tabs are all built from it.
//
// To add an app: add an entry here, then create app/<href>/page.tsx.
// (tests/apps.test.ts fails if a "live" app has no page.)

import type { LucideIcon } from "lucide-react";
import { Clapperboard, Disc3, Gamepad2, ListChecks, Moon, Sparkles, Swords, Users } from "lucide-react";

export type AppStatus = "live" | "soon";

export type AppInfo = {
  id: string;
  name: string;
  tagline: string;
  href: string;
  icon: LucideIcon;
  accent: string; // Tailwind gradient classes for the icon tile
  status: AppStatus;
  phase: string; // where it sits in the learning plan
  links?: { href: string; label: string }[]; // sub-pages, shown as tabs inside the app
};

export const APPS: AppInfo[] = [
  {
    id: "chill",
    name: "Chill Corner",
    tagline: "Ambient sounds, a focus timer and tips",
    href: "/chill",
    icon: Moon,
    accent: "from-violet-500 to-fuchsia-500",
    status: "live",
    phase: "Stages 1–3",
    links: [
      { href: "/chill", label: "Focus" },
      { href: "/chill/tips", label: "Tips" },
    ],
  },
  {
    id: "music",
    name: "Music",
    tagline: "Songs with vocals, played by MyWeb itself: community charts",
    href: "/music",
    icon: Disc3,
    accent: "from-rose-500 to-orange-400",
    status: "live",
    phase: "Stage 7",
    links: [
      { href: "/music", label: "Charts" },
      { href: "/music/add", label: "Add songs" },
    ],
  },
  {
    id: "arcade",
    name: "Mini Arcade",
    tagline: "2048, Snake and memory cards",
    href: "/arcade",
    icon: Gamepad2,
    accent: "from-amber-400 to-orange-500",
    status: "soon",
    phase: "Phase 1",
  },
  {
    id: "watchlist",
    name: "WatchList",
    tagline: "Find, rate and save movies and anime",
    href: "/watchlist",
    icon: Clapperboard,
    accent: "from-sky-400 to-indigo-500",
    status: "soon",
    phase: "Phase 2",
  },
  {
    id: "hobby-hub",
    name: "Hobby Hub",
    tagline: "Post and chat in hobby groups",
    href: "/hobby-hub",
    icon: Users,
    accent: "from-emerald-400 to-teal-500",
    status: "soon",
    phase: "Phase 3",
  },
  {
    id: "habits",
    name: "Habit & Reading Tracker",
    tagline: "Streaks, charts and reminders",
    href: "/habits",
    icon: ListChecks,
    accent: "from-lime-400 to-emerald-500",
    status: "soon",
    phase: "Phase 3–4",
  },
  {
    id: "arcade-online",
    name: "Arcade Online",
    tagline: "Real-time multiplayer games",
    href: "/arcade-online",
    icon: Swords,
    accent: "from-rose-400 to-red-500",
    status: "soon",
    phase: "Phase 4",
  },
  {
    id: "companion",
    name: "Free-time Companion",
    tagline: "An AI buddy that suggests what to do next",
    href: "/companion",
    icon: Sparkles,
    accent: "from-fuchsia-400 to-purple-600",
    status: "soon",
    phase: "Phase 5",
  },
];

export const LIVE_APPS = APPS.filter((app) => app.status === "live");

export function getApp(id: string): AppInfo {
  const app = APPS.find((a) => a.id === id);
  if (!app) throw new Error(`Unknown app: ${id}`);
  return app;
}

// "/chill/tips/x" is inside "/chill"; "/" only matches itself.
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
