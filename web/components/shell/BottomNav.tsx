"use client";

import { House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMe } from "@/features/me/MeProvider";
import { isActive, LIVE_APPS } from "@/lib/apps";
import { cn } from "@/lib/cn";

// Phone navigation: a tab bar at the bottom, within thumb reach. Built from the app registry.
export function BottomNav() {
  const pathname = usePathname();
  const { user } = useMe();
  const items = [
    { href: "/", label: "Home", icon: House },
    ...LIVE_APPS.map((app) => ({ href: app.href, label: app.shortName ?? app.name.split(" ")[0], icon: app.icon })),
    { href: "/account", label: user ? "You" : "Name", icon: UserRound },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-strong/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition",
                  active ? "text-primary" : "text-muted hover:text-text",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
