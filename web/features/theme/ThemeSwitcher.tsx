"use client";

// Two looks for the same setting:
//   <ThemeSwitcher />          three buttons with icons, for the sidebar and settings
//   <ThemeSwitcher compact />  one round button that cycles System → Light → Dark, for the phone header

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { getThemePref, setThemePref, subscribeTheme, type ThemePref } from "./theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function useThemePref(): ThemePref {
  // The server can't know your choice, so it renders "system"; the browser then shows the real one.
  return useSyncExternalStore(subscribeTheme, getThemePref, () => "system");
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const pref = useThemePref();

  if (compact) {
    const i = OPTIONS.findIndex((o) => o.value === pref);
    const current = OPTIONS[i];
    const next = OPTIONS[(i + 1) % OPTIONS.length];
    const Icon = current.icon;
    return (
      <button
        type="button"
        onClick={() => setThemePref(next.value)}
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
        title={`Theme: ${current.label}`}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-strong/70 text-muted transition hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  const index = OPTIONS.findIndex((o) => o.value === pref);

  return (
    <div role="group" aria-label="Theme" className="relative grid grid-cols-3 rounded-2xl border border-border bg-surface-muted p-1">
      {/* The highlight slides under the chosen option */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-surface-strong shadow-sm transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === pref;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setThemePref(value)}
            className={cn(
              "relative z-10 flex cursor-pointer flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-primary")} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
