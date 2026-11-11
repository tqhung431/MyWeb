"use client";

// Stage 15: small messages that pop up for a few seconds ("Saved", "Couldn't delete right now").
//
//   const toast = useToast();
//   toast("Added to your list");
//   toast("Couldn't delete right now", { tone: "error" });
//
// They're in a "live region", so screen readers read them out too.

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "error";
type Toast = { id: number; message: string; tone: Tone };
type ToastFn = (message: string, options?: { tone?: Tone }) => void;

const ToastContext = createContext<ToastFn | null>(null);
const ICONS = { info: Info, success: CircleCheck, error: CircleAlert };
const SHOW_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const toast = useCallback<ToastFn>(
    (message, options) => {
      const id = next.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone: options?.tone ?? "info" }]); // at most 3 at once
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), SHOW_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:items-end"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex max-w-sm animate-pop items-center gap-3 rounded-2xl border border-border bg-surface-strong py-2.5 pr-2 pl-4 text-sm font-semibold text-text shadow-xl"
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", t.tone === "success" ? "text-emerald-500" : t.tone === "error" ? "text-rose-500" : "text-primary")}
                aria-hidden="true"
              />
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Close message"
                className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// Outside the provider (in tests) toasts are simply skipped.
export function useToast(): ToastFn {
  return useContext(ToastContext) ?? (() => {});
}
