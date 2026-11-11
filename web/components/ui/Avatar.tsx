// A round picture of the user: their GitHub photo, or their initials on a gradient.

import { cn } from "@/lib/cn";

const sizes = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-20 w-20 text-2xl" } as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

type Props = { name: string; src?: string | null; size?: keyof typeof sizes };

export function Avatar({ name, src, size = "md" }: Props) {
  if (src) {
    // A plain <img>: next/image would need every avatar host listed in next.config.
    return <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover ring-2 ring-border", sizes[size])} />;
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-primary to-primary-2 font-bold text-white",
        sizes[size],
      )}
    >
      {initials(name)}
    </span>
  );
}
