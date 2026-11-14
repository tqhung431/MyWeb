"use client";

// Phone navigation: a tab bar at the bottom, within thumb reach. Built from the app registry.
// Stage 12: with more apps than fit, it shows Home, the pinned apps (pinned: true in lib/apps.ts),
// and "Apps", which opens a grid of every app.

import { House, LayoutGrid, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { UnreadDot, useUnread } from "@/features/hobby/UnreadProvider";
import { useMe } from "@/features/me/MeProvider";
import { isActive, LIVE_APPS } from "@/lib/apps";
import { cn } from "@/lib/cn";

import { useT } from "@/lib/i18n/I18nProvider";
const tab = "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition";

export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const { user } = useMe();
  const [open, setOpen] = useState(false);
  const { badge } = useUnread(); // Stage 28: Messages and Hobby Hub each have their own badge

  useEffect(() => setOpen(false), [pathname]); // close the grid after choosing

  const pinned = LIVE_APPS.filter((a) => a.pinned);
  const items = [{ href: "/", label: t("Home"), icon: House }, ...pinned.map((a) => ({ href: a.href, label: t(a.shortName ?? a.name), icon: a.icon }))];
  const inOther = !items.some((i) => isActive(pathname, i.href)); // on an app that isn't pinned

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <div
          id="all-apps"
          role="dialog"
          aria-label={t("All apps")}
          className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 animate-pop rounded-3xl border border-border bg-surface-strong p-4 shadow-card lg:hidden"
        >
          <ul className="grid grid-cols-4 gap-x-2 gap-y-4">
            {LIVE_APPS.map((app) => (
              <li key={app.id}>
                <Link
                  href={app.href}
                  className="flex flex-col items-center gap-1.5 text-center text-[11px] leading-tight font-semibold"
                  aria-current={isActive(pathname, app.href) ? "page" : undefined}
                >
                  <span className="relative">
                    <AppIcon icon={app.icon} accent={app.accent} size="md" />
                    <UnreadDot count={badge(app.href)} className="absolute -top-1.5 -right-1.5" />
                  </span>
                  {t(app.shortName ?? app.name)}
                  {badge(app.href) > 0 && <span className="sr-only">, {t("{n} unread", { n: badge(app.href) })}</span>}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/account" className="flex flex-col items-center gap-1.5 text-center text-[11px] leading-tight font-semibold">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-muted text-muted">
                  <UserRound className="h-5 w-5" aria-hidden="true" />
                </span>
                {user ? t("You") : t("Pick a name")}
              </Link>
            </li>
          </ul>
        </div>
      )}
      <nav
        aria-label={t("Main")}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-strong/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href) && !open;
            return (
              <li key={href} className="flex-1">
                <Link href={href} aria-current={active ? "page" : undefined} className={cn(tab, active ? "text-primary" : "text-muted hover:text-text")}>
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <UnreadDot count={badge(href)} className="absolute -top-1.5 -right-2.5" />
                  </span>
                  {label}
                  {badge(href) > 0 && <span className="sr-only">, {t("{n} unread", { n: badge(href) })}</span>}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="all-apps"
              className={cn(tab, "w-full cursor-pointer", open || inOther ? "text-primary" : "text-muted hover:text-text")}
            >
              {open ? <X className="h-5 w-5" aria-hidden="true" /> : <LayoutGrid className="h-5 w-5" aria-hidden="true" />}
              {t("Apps")}
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
