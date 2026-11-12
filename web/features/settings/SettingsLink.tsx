"use client";

// Stage 21: the gear in the phone header. Language and colours live on /settings now, not on every page.
import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";

export function SettingsLink() {
  const t = useT();
  const active = usePathname() === "/settings";
  return (
    <Link
      href="/settings"
      aria-label={t("Settings")}
      title={t("Settings")}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-strong text-muted transition hover:text-text",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
        active && "text-primary",
      )}
    >
      <Settings className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
