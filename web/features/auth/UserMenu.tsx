"use client";

// Signed in: your initials and name, linking to /account.
// Guest: a small card saying everything works without an account, with an optional sign-in link.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useAuth } from "./AuthProvider";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const next = pathname === "/login" || pathname === "/register" ? "/" : pathname;
  const signInHref = `/login?next=${encodeURIComponent(next)}`;

  if (compact) {
    // Phone header: a small round button
    return user ? (
      <Link href="/account" aria-label={`Account: ${user.name}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Avatar name={user.name} size="sm" />
      </Link>
    ) : (
      <Link href={signInHref} className="flex items-center gap-2 rounded-full py-1 pr-1 pl-3 text-xs font-semibold text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Guest
        <Avatar size="sm" />
      </Link>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted p-2.5">
        <Avatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Guest</p>
          <Link href={signInHref} className="text-xs font-semibold text-primary hover:underline">
            Sign in to sync (optional)
          </Link>
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
        <span className="block truncate text-xs text-muted">{user.email}</span>
      </span>
    </Link>
  );
}
