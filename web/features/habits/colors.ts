import type { Color } from "@/lib/api/habits";

// Tailwind needs full class names written out (it can't see "bg-" + color)
export const COLOR: Record<Color, { solid: string; soft: string; text: string; cell: string }> = {
  violet: { solid: "bg-violet-500", soft: "bg-violet-500/15", text: "text-violet-600 dark:text-violet-300", cell: "bg-violet-500" },
  rose: { solid: "bg-rose-500", soft: "bg-rose-500/15", text: "text-rose-600 dark:text-rose-300", cell: "bg-rose-500" },
  amber: { solid: "bg-amber-500", soft: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-300", cell: "bg-amber-500" },
  emerald: { solid: "bg-emerald-500", soft: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-300", cell: "bg-emerald-500" },
  sky: { solid: "bg-sky-500", soft: "bg-sky-500/15", text: "text-sky-600 dark:text-sky-300", cell: "bg-sky-500" },
  fuchsia: { solid: "bg-fuchsia-500", soft: "bg-fuchsia-500/15", text: "text-fuchsia-600 dark:text-fuchsia-300", cell: "bg-fuchsia-500" },
};
export const COLORS = Object.keys(COLOR) as Color[];
export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function mondayOf(day: string): string {
  const weekday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return new Date(Date.parse(`${day}T00:00:00Z`) - weekday * 86_400_000).toISOString().slice(0, 10);
}
