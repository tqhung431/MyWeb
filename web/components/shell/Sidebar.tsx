"use client"; // usePathname reads the current URL to highlight the active app

import { House, Info, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";
import { Badge } from "@/components/ui/Badge";
import { UnreadDot, useUnread } from "@/features/hobby/UnreadProvider";
import { UserMenu } from "@/features/me/UserMenu";
import { LivePill } from "@/features/realtime/LiveNow";
import { APPS, appForPath } from "@/lib/apps";
import { cn } from "@/lib/cn";
import { Brand } from "./Brand";

import { useT } from "@/lib/i18n/I18nProvider";
// Desktop navigation (hidden on phones; BottomNav takes over there).
export function Sidebar() {
  const t = useT();
  const pathname = usePathname();
  const { badge } = useUnread();
  const current = appForPath(pathname); // Stage 30: /arena/chess is the Games app // Stage 28: Messages and Hobby Hub each have their own

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Brand />
      </div>

      <nav aria-label={t("Main")} className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <PlainLink href="/" label={t("Home")} icon={House} active={pathname === "/"} />

        <p className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-muted uppercase">{t("Apps")}</p>
        {APPS.map((app) =>
          app.status === "live" ? (
            <Link key={app.id} href={app.href} aria-current={current?.id === app.id ? "page" : undefined} className={itemClasses(current?.id === app.id)}>
              <AppIcon icon={app.icon} accent={app.accent} size="sm" />
              <span className="truncate">{t(app.name)}</span>
              {badge(app.href) > 0 && (
                <span className="ml-auto">
                  <UnreadDot count={badge(app.href)} />
                  <span className="sr-only"> {t("unread")}</span>
                </span>
              )}
            </Link>
          ) : (
            <div key={app.id} aria-disabled="true" className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted">
              <AppIcon icon={app.icon} accent={app.accent} size="sm" muted />
              <span className="truncate">{t(app.name)}</span>
              <span className="ml-auto">
                <Badge>{t("Soon")}</Badge>
              </span>
            </div>
          ),
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <LivePill className="self-start" />
        <PlainLink href="/settings" label={t("Settings")} icon={Settings} active={pathname === "/settings"} />
        <PlainLink href="/about" label={t("About")} icon={Info} active={pathname === "/about"} />
        <UserMenu />
      </div>
    </aside>
  );
}

function itemClasses(active: boolean) {
  return cn(
    "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
    active ? "bg-primary/12 text-text" : "text-muted hover:bg-surface-muted hover:text-text",
  );
}

function PlainLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={itemClasses(active)}>
      <span className="inline-flex h-8 w-8 items-center justify-center">
        <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}
