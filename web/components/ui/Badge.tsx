import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-surface-muted text-muted",
  primary: "bg-primary/15 text-primary",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
} as const;

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}
