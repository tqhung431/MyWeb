// The round badge picture. The API names the icon; we map names to Lucide icons here,
// so the API never sends code or markup to the browser.

import { Award, Flame, Hourglass, Leaf, Lock, MoonStar, Repeat, Sprout, Sunrise, TreePine, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = { Sprout, Leaf, TreePine, Repeat, Flame, Hourglass, Sunrise, MoonStar };

const sizes = { md: "h-11 w-11 [&>svg]:h-5 [&>svg]:w-5", lg: "h-14 w-14 [&>svg]:h-6 [&>svg]:w-6" } as const;

export function BadgeIcon({ name, earned, size = "lg" }: { name: string; earned: boolean; size?: keyof typeof sizes }) {
  const Icon = earned ? (ICONS[name] ?? Award) : Lock;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        earned
          ? "bg-linear-to-br from-amber-300 via-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-200/60"
          : "border border-dashed border-border bg-surface-muted text-muted",
        sizes[size],
      )}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}
