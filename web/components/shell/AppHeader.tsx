"use client";

// The header inside an app: its icon, name and sub-page tabs (from lib/apps.ts).
// Used by app/focus/layout.tsx, and by every future app's layout.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { UnreadDot, useUnread } from "@/features/hobby/UnreadProvider";
import { getApp } from "@/lib/apps";
import { cn } from "@/lib/cn";

import { useT } from "@/lib/i18n/I18nProvider";
export function AppHeader({ appId, className }: { appId: string; className?: string }) {
  const t = useT();
  const app = getApp(appId);
  const pathname = usePathname();
  const { badge } = useUnread();

  // The longest matching link wins, so /focus/tips/x highlights "Tips", not "Focus".
  const activeHref = app.links?.filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Stage 28: many tabs (Arena has 7) go on their own line under the title and wrap (phone too), instead of hiding off the edge
  const many = (app.links?.length ?? 0) > 4;
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // on a phone the tabs scroll sideways: bring the current one into view
    const el = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    const nav = navRef.current;
    if (el && nav && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = el.offsetLeft - nav.clientWidth / 2 + el.offsetWidth / 2;
  }, [activeHref]);

  return (
    <header className={cn("mb-6 flex flex-col gap-4", !many && "sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-4">
        <AppIcon icon={app.icon} accent={app.accent} size="lg" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t(app.name)}</h1>
          <p className="text-sm text-muted">{t(app.tagline)}</p>
        </div>
      </div>

      {app.links && (
        <nav
          ref={navRef}
          aria-label={t("{app} sections", { app: t(app.name) })}
          className={cn(
            "inline-flex max-w-full self-start overflow-x-auto rounded-full border border-border bg-surface-muted p-1 [scrollbar-width:thin]",
            many ? "flex-wrap rounded-2xl" : "sm:self-auto",
          )}
        >
          {app.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={activeHref === link.href ? "page" : undefined}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition sm:px-4", // Stage 23: never wrap; scroll sideways on a phone
                activeHref === link.href ? "bg-surface-strong text-text shadow-sm" : "text-muted hover:text-text",
              )}
            >
              {t(link.label)}
              {badge(link.href) > 0 && (
                <>
                  <UnreadDot count={badge(link.href)} className="ml-1.5 align-[1px]" />
                  <span className="sr-only"> {t("unread")}</span>
                </>
              )}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
