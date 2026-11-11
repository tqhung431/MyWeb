"use client";

// Signed in: your avatar and name, linking to /account. Signed out: a "Sign in" button.

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useAuth } from "./AuthProvider";

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) {
    const next = pathname === "/login" || pathname === "/register" ? "/" : pathname;
    return (
      <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonClasses("primary", compact ? "sm" : "md", compact ? "" : "w-full")}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Sign in
      </Link>
    );
  }

  if (compact) {
    return (
      <Link href="/account" aria-label={`Account: ${user.name}`} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
      </Link>
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
      <Avatar name={user.name} src={user.avatarUrl} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{user.name}</span>
        <span className="block truncate text-xs text-muted">{user.email}</span>
      </span>
    </Link>
  );
}
