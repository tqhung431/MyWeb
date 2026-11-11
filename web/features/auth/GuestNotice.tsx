"use client";

// A friendly note on Home for guests: no account needed; signing in only adds syncing.

import { UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function GuestNotice() {
  const { user } = useAuth();
  if (user) return null;

  return (
    <p className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted backdrop-blur-xl">
      <UserRoundCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <span>
        You&apos;re using MyWeb as a <strong className="text-text">guest</strong>. Everything works, and your history is
        kept on this device.{" "}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>{" "}
        only if you want it on other PCs too.
      </span>
    </p>
  );
}
