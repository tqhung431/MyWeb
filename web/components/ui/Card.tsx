import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// A frosted-glass panel. Every app builds its screens from these.
export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl sm:p-6", className)}
      {...props}
    />
  );
}

type HeaderProps = { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; id?: string };

export function CardHeader({ title, subtitle, action, id }: HeaderProps) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
