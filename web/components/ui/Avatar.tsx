// A round badge with the user's initials on a gradient (or a person icon for guests).

import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" } as const;

// Split into what a person sees as characters ("graphemes"): an emoji like 🌸 or 👵🏽 is several
// JavaScript "characters" underneath, and cutting one in half shows a broken symbol.
const segmenter = new Intl.Segmenter();
const chars = (s: string) => Array.from(segmenter.segment(s), (g) => g.segment);

// "Linh Tran" → "LT", "Mai 🌸" → "M🌸", "Dad" → "DA"
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? chars(parts[0])[0] + chars(parts[parts.length - 1])[0] : chars(parts[0] ?? "?").slice(0, 2).join("");
  return letters.toUpperCase();
}

type Props = { name?: string; size?: keyof typeof sizes }; // no name = guest

export function Avatar({ name, size = "md" }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        name ? "bg-linear-to-br from-primary to-primary-2 text-white" : "border border-border bg-surface-muted text-muted",
        sizes[size],
      )}
    >
      {name ? initials(name) : <UserRound className="h-1/2 w-1/2" />}
    </span>
  );
}
