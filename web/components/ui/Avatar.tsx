// A round badge with the user's initials on a gradient (or a person icon for guests).

import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" } as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
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
