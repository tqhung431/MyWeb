// The app registry: ONE list of every app in Nook.
// The sidebar, the phone tab bar, the Home grid and each app's sub-tabs are all built from it.
//
// To add an app: add an entry here, then create app/<href>/page.tsx.
// (tests/apps.test.ts fails if a "live" app has no page.)

import type { LucideIcon } from "lucide-react";
import { Clapperboard, Disc3, Gamepad2, ListChecks, MessageCircle, Moon, Sparkles, Tv, Users } from "lucide-react";

import { tx } from "@/lib/i18n/core";
// Stage 21: names and labels are wrapped in tx() so the translation test finds them; shown with t(app.name).
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
  // Stage 30: other addresses that belong to this app (the Games app spans /arcade, /arena…)
  also?: string[];
  // sub-pages, shown as tabs inside the app. `match`: more addresses that light this tab up (Stage 30)
  links?: { href: string; label: string; match?: string[] }[];
};

export const APPS: AppInfo[] = [
  {
    id: "chill",
    pinned: true,
    name: tx("Focus Room"), // Stage 29: was Chill Corner (/chill redirects)
    tagline: tx("Ambient sounds, a focus timer and tips"),
    href: "/focus",
    icon: Moon,
    accent: "from-violet-500 to-fuchsia-500",
    status: "live",
    phase: "Stages 1–3",
    links: [
      { href: "/focus", label: tx("Focus") },
      { href: "/focus/tips", label: tx("Tips") },
    ],
  },
  {
    id: "music",
    name: tx("Music"),
    tagline: tx("Songs with vocals, played by Nook itself: community charts"),
    href: "/music",
    also: ["/arena/listen"],
    icon: Disc3,
    accent: "from-rose-500 to-orange-400",
    status: "live",
    phase: "Stage 7",
    links: [
      { href: "/music", label: tx("Charts") },
      { href: "/music/add", label: tx("Add songs") },
      { href: "/arena/listen", label: tx("Listen Together") }, // Stage 30: was in Nook Arena (it's on the game server)
    ],
  },
  {
    // Stage 30: ONE Games app. Mini Arcade (/arcade), Arcade Online (/arcade-online), Nook Arena (/arena) and Nook Games
    // (/games) were four entries; their pages keep their addresses and show these tabs.
    id: "games",
    name: tx("Games"),
    tagline: tx("Quick games, party quizzes, live games with friends, and adventures"),
    href: "/games",
    also: ["/arcade", "/arcade-online", "/arena"],
    icon: Gamepad2,
    accent: "from-amber-400 to-orange-500",
    status: "live",
    phase: "Stages 10, 14, 16, 22–26, 30",
    links: [
      { href: "/games", label: tx("All games") },
      { href: "/arcade", label: tx("Quick games") },
      { href: "/arcade-online", label: tx("Party") },
      { href: "/arena", label: tx("Together") },
      { href: "/games/adventures", label: tx("Adventures"), match: ["/games/van-lo", "/arena/sprout"] },
      { href: "/games/leaderboards", label: tx("Leaderboards"), match: ["/arcade/scores", "/arcade-online/leaderboard"] },
    ],
  },
  {
    id: "watchlist",
    name: tx("WatchList"),
    shortName: tx("Watch"),
    tagline: tx("TV shows and anime: your list, and what others watch"),
    href: "/watchlist",
    icon: Clapperboard,
    accent: "from-sky-400 to-indigo-500",
    status: "live",
    phase: "Stage 12",
    links: [
      { href: "/watchlist", label: tx("My list") },
      { href: "/watchlist/search", label: tx("Find") },
      { href: "/watchlist/popular", label: tx("On Nook") },
    ],
  },
  {
    id: "messages",
    pinned: true, // Stage 28: on the phone tab bar instead of Music (Music is under "Apps")
    name: tx("Messages"),
    tagline: tx("Private chats, just the two of you"),
    href: "/messages",
    icon: MessageCircle,
    accent: "from-sky-400 to-indigo-500",
    status: "live",
    phase: "Stages 21, 28",
  },
  {
    id: "hobby-hub",
    pinned: true,
    name: tx("Hobby Hub"),
    shortName: tx("Hobbies"),
    tagline: tx("Post and chat in hobby groups, live"),
    href: "/hobby-hub",
    icon: Users,
    accent: "from-emerald-400 to-teal-500",
    status: "live",
    phase: "Stage 11",
    // Stage 28: private chats moved to their own app (Messages)
  },
  {
    id: "habits",
    name: tx("Habit & Reading Tracker"),
    shortName: tx("Habits"),
    tagline: tx("Daily habits and books: streaks, charts, reminders, works offline"),
    href: "/habits",
    icon: ListChecks,
    accent: "from-lime-400 to-emerald-500",
    status: "live",
    phase: "Stage 13",
    links: [
      { href: "/habits", label: tx("Today") },
      { href: "/habits/reading", label: tx("Reading") },
      { href: "/habits/progress", label: tx("Progress") },
    ],
  },
  {
    id: "tv",
    name: tx("Nook TV"),
    shortName: tx("TV"),
    tagline: tx("YouTube picks from the admin, and live screen shares"),
    href: "/tv",
    icon: Tv,
    accent: "from-red-500 to-rose-600",
    status: "live",
    phase: "Stage 22",
    links: [
      { href: "/tv", label: tx("Watch") },
      { href: "/tv/live", label: tx("Live") },
    ],
  },
  {
    id: "companion",
    name: tx("Free-time Companion"),
    tagline: tx("Ask anything about Nook: apps, games, songs and tips"),
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

// Stage 30: which app a page belongs to. The longest address wins, so /arena/listen is Music, /arena/chess is Games.
export function appForPath(pathname: string): AppInfo | undefined {
  let best: { app: AppInfo; len: number } | undefined;
  for (const app of APPS)
    for (const href of [app.href, ...(app.also ?? [])]) if (isActive(pathname, href) && href.length > (best?.len ?? -1)) best = { app, len: href.length };
  return best?.app;
}

// The tab inside an app for this page: the longest matching address (a tab's own or one of its `match`)
export function activeLink(app: AppInfo, pathname: string): string | undefined {
  let best: { href: string; len: number } | undefined;
  for (const l of app.links ?? [])
    for (const href of [l.href, ...(l.match ?? [])]) if (isActive(pathname, href) && href.length > (best?.len ?? -1)) best = { href: l.href, len: href.length };
  return best?.href;
}

// "/focus/tips/x" is inside "/focus"; "/" only matches itself.
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
