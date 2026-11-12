"use client";

import { Clock, Flame, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useFocus } from "./FocusProvider";
import { streak } from "./logic";

import { useT } from "@/lib/i18n/I18nProvider";
export function TodayStats() {
  const t = useT();
  const { summary, status } = useFocus();
  const show = (n: number | undefined) => (status === "ready" && n !== undefined ? String(n) : "–");

  return (
    <div className="grid grid-cols-3 gap-3">
      <Stat icon={Timer} label={t("Sessions today")} value={show(summary?.today.sessions)} />
      <Stat icon={Clock} label={t("Minutes today")} value={show(summary?.today.minutes)} />
      <Stat icon={Flame} label={t("Day streak")} value={show(summary ? streak(summary.days) : undefined)} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <p className="mt-3 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      <p className="text-xs text-muted sm:text-sm">{label}</p>
    </div>
  );
}
