// The rounded, gradient icon tile used for each app (like a phone home screen).

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const sizes = {
  sm: "h-8 w-8 rounded-xl [&>svg]:h-4 [&>svg]:w-4",
  md: "h-11 w-11 rounded-2xl [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7",
} as const;

type Props = { icon: LucideIcon; accent: string; size?: keyof typeof sizes; muted?: boolean };

export function AppIcon({ icon: Icon, accent, size = "md", muted }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-linear-to-br text-white shadow-md",
        accent,
        sizes[size],
        muted && "opacity-60 grayscale-[35%]",
      )}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}
