// Achievements: small badges earned from your focus history.
// The rules live here; the worker checks them in the background (src/jobs/handlers.ts).

export type SessionLite = { minutes: number; completedAt: Date };

type Rule = {
  code: string;
  title: string;
  description: string;
  icon: string; // a Lucide icon name, drawn by the website
  earned: (sessions: SessionLite[], tz: string) => boolean;
};

const dayKey = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
const hourOf = (d: Date, tz: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(d));

function longestStreak(sessions: SessionLite[], tz: string): number {
  const days = [...new Set(sessions.map((s) => dayKey(s.completedAt, tz)))].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of days) {
    const t = Date.parse(`${d}T00:00:00Z`) / 86_400_000; // day number
    run = prev !== null && t - prev === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function mostInOneDay(sessions: SessionLite[], tz: string): number {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const k = dayKey(s.completedAt, tz);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

export const ACHIEVEMENTS: Rule[] = [
  {
    code: "first-focus",
    title: "First focus",
    description: "Finish your first focus session",
    icon: "Sprout",
    earned: (s) => s.length >= 1,
  },
  {
    code: "five-sessions",
    title: "Getting into it",
    description: "Finish 5 focus sessions",
    icon: "Leaf",
    earned: (s) => s.length >= 5,
  },
  {
    code: "twenty-sessions",
    title: "Deep worker",
    description: "Finish 20 focus sessions",
    icon: "TreePine",
    earned: (s) => s.length >= 20,
  },
  {
    code: "four-in-a-day",
    title: "Full round",
    description: "4 focus sessions in one day",
    icon: "Repeat",
    earned: (s, tz) => mostInOneDay(s, tz) >= 4,
  },
  {
    code: "streak-3",
    title: "On a roll",
    description: "Focus 3 days in a row",
    icon: "Flame",
    earned: (s, tz) => longestStreak(s, tz) >= 3,
  },
  {
    code: "hundred-minutes",
    title: "Hundred minutes",
    description: "100 minutes of focus in total",
    icon: "Hourglass",
    earned: (s) => s.reduce((sum, x) => sum + x.minutes, 0) >= 100,
  },
  {
    code: "early-bird",
    title: "Early bird",
    description: "Finish a session before 7 am",
    icon: "Sunrise",
    earned: (s, tz) => s.some((x) => hourOf(x.completedAt, tz) < 7 && hourOf(x.completedAt, tz) >= 4),
  },
  {
    code: "night-owl",
    title: "Night owl",
    description: "Finish a session after 10 pm",
    icon: "MoonStar",
    earned: (s, tz) => s.some((x) => hourOf(x.completedAt, tz) >= 22 || hourOf(x.completedAt, tz) < 4),
  },
];

export function earnedCodes(sessions: SessionLite[], tz: string): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(sessions, tz)).map((a) => a.code);
}
