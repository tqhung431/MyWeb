"use client";

// You, in the sidebar and the phone header: your name linking to /account ("You"),
// or a "Pick a name" button if you haven't yet.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useMe } from "./MeProvider";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user, askName } = useMe();
  const pathname = usePathname();

  if (compact) {
    // Phone header: a small round button
    return user ? (
      <Link
        href="/account"
        aria-label={`You: ${user.name}`}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Avatar name={user.name} size="sm" />
      </Link>
    ) : (
      <button
        type="button"
        onClick={askName}
        className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface-strong py-1 pr-1 pl-3 text-xs font-semibold text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Pick a name
        <Avatar size="sm" />
      </button>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-2.5">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Guest</p>
          <button type="button" onClick={askName} className="cursor-pointer text-xs font-semibold text-primary hover:underline">
            Pick a name
          </button>
        </div>
      </div>
    );
  }

  return (
    <Link
      href="/account"
      aria-current={pathname === "/account" ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        pathname === "/account" ? "bg-primary/12" : "hover:bg-surface-muted",
      )}
    >
      <Avatar name={user.name} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{user.name}</span>
        <span className="block truncate text-xs text-muted">You · your data</span>
      </span>
    </Link>
  );
}
