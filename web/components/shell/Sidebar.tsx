"use client"; // usePathname reads the current URL to highlight the active app

import { House, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";
import { Badge } from "@/components/ui/Badge";
import { UserMenu } from "@/features/auth/UserMenu";
import { ThemeSwitcher } from "@/features/theme/ThemeSwitcher";
import { LivePill } from "@/features/realtime/LiveNow";
import { APPS, isActive } from "@/lib/apps";
import { cn } from "@/lib/cn";
import { Brand } from "./Brand";

// Desktop navigation (hidden on phones; BottomNav takes over there).
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh flex-col gap-8 border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Brand />
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <PlainLink href="/" label="Home" icon={House} active={pathname === "/"} />

        <p className="mt-6 mb-2 px-3 text-xs font-semibold tracking-wider text-muted uppercase">Apps</p>
        {APPS.map((app) =>
          app.status === "live" ? (
            <Link
              key={app.id}
              href={app.href}
              aria-current={isActive(pathname, app.href) ? "page" : undefined}
              className={itemClasses(isActive(pathname, app.href))}
            >
              <AppIcon icon={app.icon} accent={app.accent} size="sm" />
              <span className="truncate">{app.name}</span>
            </Link>
          ) : (
            <div key={app.id} aria-disabled="true" className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted">
              <AppIcon icon={app.icon} accent={app.accent} size="sm" muted />
              <span className="truncate">{app.name}</span>
              <span className="ml-auto">
                <Badge>Soon</Badge>
              </span>
            </div>
          ),
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <LivePill className="self-start" />
        <ThemeSwitcher />
        <PlainLink href="/about" label="About" icon={Info} active={pathname === "/about"} />
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
