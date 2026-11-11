// The app registry: ONE list of every app in Nook.
// The sidebar, the phone tab bar, the Home grid and each app's sub-tabs are all built from it.
//
// To add an app: add an entry here, then create app/<href>/page.tsx.
// (tests/apps.test.ts fails if a "live" app has no page.)

import type { LucideIcon } from "lucide-react";
import { Clapperboard, Disc3, Gamepad2, ListChecks, Moon, Mountain, Sparkles, Swords, Users } from "lucide-react";

export type AppStatus = "live" | "soon";

export type AppInfo = {
  id: string;
  name: string;
  shortName?: string; // for the phone tab bar (default: the first word of the name)
  pinned?: boolean; // Stage 12: on the phone tab bar; the others are under "Apps"
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
    pinned: true,
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
    pinned: true,
    name: "Music",
    tagline: "Songs with vocals, played by Nook itself: community charts",
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
    shortName: "Arcade",
    tagline: "Six silly games, with high scores to beat",
    href: "/arcade",
    icon: Gamepad2,
    accent: "from-amber-400 to-orange-500",
    status: "live",
    phase: "Stage 10",
    links: [
      { href: "/arcade", label: "Games" },
      { href: "/arcade/scores", label: "Leaderboards" },
    ],
  },
  {
    id: "watchlist",
    name: "WatchList",
    shortName: "Watch",
    tagline: "TV shows and anime: your list, and what others watch",
    href: "/watchlist",
    icon: Clapperboard,
    accent: "from-sky-400 to-indigo-500",
    status: "live",
    phase: "Stage 12",
    links: [
      { href: "/watchlist", label: "My list" },
      { href: "/watchlist/search", label: "Find" },
      { href: "/watchlist/popular", label: "On Nook" },
    ],
  },
  {
    id: "hobby-hub",
    pinned: true,
    name: "Hobby Hub",
    shortName: "Hobbies",
    tagline: "Post and chat in hobby groups, live",
    href: "/hobby-hub",
    icon: Users,
    accent: "from-emerald-400 to-teal-500",
    status: "live",
    phase: "Stage 11",
  },
  {
    id: "habits",
    name: "Habit & Reading Tracker",
    shortName: "Habits",
    tagline: "Daily habits and books: streaks, charts, reminders, works offline",
    href: "/habits",
    icon: ListChecks,
    accent: "from-lime-400 to-emerald-500",
    status: "live",
    phase: "Stage 13",
    links: [
      { href: "/habits", label: "Today" },
      { href: "/habits/reading", label: "Reading" },
      { href: "/habits/progress", label: "Progress" },
    ],
  },
  {
    id: "arcade-online",
    name: "Arcade Online",
    shortName: "Quiz",
    tagline: "Quiz Party: play live against everyone on Nook",
    href: "/arcade-online",
    icon: Swords,
    accent: "from-rose-400 to-red-500",
    status: "live",
    phase: "Stage 14",
    links: [
      { href: "/arcade-online", label: "Play" },
      { href: "/arcade-online/leaderboard", label: "Leaderboard" },
    ],
  },
  {
    id: "games",
    name: "Nook Games",
    shortName: "Games",
    tagline: "Bigger games with saves: Vân Lộ, a cultivation adventure",
    href: "/games",
    icon: Mountain,
    accent: "from-stone-500 to-red-700",
    status: "live",
    phase: "Stage 16",
  },
  {
    id: "companion",
    name: "Free-time Companion",
    tagline: "A local AI buddy that knows Nook's songs and tips",
    href: "/companion",
    icon: Sparkles,
    accent: "from-fuchsia-400 to-purple-600",
    status: "live",
    phase: "Stage 9",
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
