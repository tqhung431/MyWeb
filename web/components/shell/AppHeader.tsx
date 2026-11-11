"use client";

// The header inside an app: its icon, name and sub-page tabs (from lib/apps.ts).
// Used by app/chill/layout.tsx, and by every future app's layout.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";
import { getApp } from "@/lib/apps";
import { cn } from "@/lib/cn";

export function AppHeader({ appId, className }: { appId: string; className?: string }) {
  const app = getApp(appId);
  const pathname = usePathname();

  // The longest matching link wins, so /chill/tips/x highlights "Tips", not "Focus".
  const activeHref = app.links
    ?.filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-4">
        <AppIcon icon={app.icon} accent={app.accent} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{app.name}</h1>
          <p className="text-sm text-muted">{app.tagline}</p>
        </div>
      </div>

      {app.links && (
        <nav aria-label={`${app.name} sections`} className="inline-flex self-start rounded-full border border-border bg-surface-muted p-1 sm:self-auto">
          {app.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition",
                activeHref === link.href ? "bg-surface-strong text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
