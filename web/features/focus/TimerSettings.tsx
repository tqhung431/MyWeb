"use client";

// Choose how long focus and breaks last: quick presets, or set each one yourself.

import { Minus, Plus } from "lucide-react";
import type { Mode } from "@/lib/api/sessions";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/AuthProvider";
import { useFocus } from "./FocusProvider";
import { LIMITS, MODES, PRESETS } from "./logic";

export function TimerSettings() {
  const { durations, setDurations, pendingDurations } = useFocus();
  const { user } = useAuth();

  return (
    <section aria-label="Timer lengths" className="rounded-2xl border border-border bg-surface-muted p-4">
      <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Presets</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const active = (Object.keys(p.durations) as Mode[]).every((m) => p.durations[m] === durations[m]);
          return (
            <button
              key={p.name}
              type="button"
              aria-pressed={active}
              onClick={() => setDurations(p.durations)}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                active ? "border-primary/50 bg-primary/12" : "border-border bg-surface-strong/60 hover:border-primary/30",
              )}
            >
              <span className="block text-sm font-semibold">{p.name}</span>
              <span className="block text-xs text-muted tabular-nums">
                {p.durations.focus} / {p.durations.short} / {p.durations.long}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <Stepper key={m} mode={m} value={durations[m]} onChange={(v) => setDurations({ [m]: v })} />
        ))}
      </div>

      <p className="mt-3 text-xs text-muted" aria-live="polite">
        {pendingDurations
          ? "Your session keeps its length; the new one starts with the next session."
          : user
            ? "Saved to your account: the same on all your devices."
            : "Saved on this device."}
      </p>
    </section>
  );
}

function Stepper({ mode, value, onChange }: { mode: Mode; value: number; onChange: (v: number) => void }) {
  const { min, max } = LIMITS[mode];
  const id = `duration-${mode}`;
  const step = value >= 30 ? 5 : 1; // big numbers move in 5s
  const button =
    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-surface-strong text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-semibold">
        {MODES[mode].label}
      </label>
      <div className="flex items-center gap-2">
        <button type="button" className={button} onClick={() => onChange(value - step)} disabled={value <= min} aria-label={`Shorter ${MODES[mode].label.toLowerCase()}`}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex items-baseline gap-1">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
            className="w-14 rounded-lg border border-border bg-surface-strong px-2 py-1 text-center font-semibold tabular-nums focus:border-primary focus:outline-none"
          />
          <span className="text-xs text-muted">min</span>
        </div>
        <button type="button" className={button} onClick={() => onChange(value + step)} disabled={value >= max} aria-label={`Longer ${MODES[mode].label.toLowerCase()}`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
