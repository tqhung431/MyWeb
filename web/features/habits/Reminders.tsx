"use client";

// Habit reminders (Stage 13). The worker sends "reminder" to your open Nook tabs at the habit's time.
// Nook shows a pop-up with a "Done" button, and, if you allowed it, a system notification too
// (handy when Nook is in a background tab).
//
// Browsers only allow system notifications on secure pages: https://localhost, or https:// through Caddy.
// On http://192.168.x.x (other phones on the Wi-Fi), the in-page pop-up still works while Nook is open.

import { Bell, BellOff, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { setHabitDay } from "@/lib/api/habits";

type Reminder = { habitId: number; name: string; emoji: string; day: string };

const canNotify = () => typeof window !== "undefined" && "Notification" in window && window.isSecureContext;

export function ReminderSwitch() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPermission(canNotify() ? Notification.permission : "unsupported"), []);

  if (permission === "granted") {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/12 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <Bell className="h-4 w-4" aria-hidden="true" /> Reminders on
      </span>
    );
  }
  if (permission === "unsupported" || permission === "denied") {
    return (
      <span
        className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-xs font-semibold text-muted"
        title={
          permission === "denied"
            ? "Notifications are blocked in this browser's settings"
            : "System notifications need https://. Reminders still pop up while Nook is open."
        }
      >
        <BellOff className="h-4 w-4" aria-hidden="true" /> In-app reminders
      </span>
    );
  }
  return (
    <Button variant="secondary" size="sm" onClick={async () => setPermission(await Notification.requestPermission())}>
      <Bell className="h-4 w-4" aria-hidden="true" /> Turn on reminders
    </Button>
  );
}

export function HabitReminders() {
  const [items, setItems] = useState<Reminder[]>([]);

  useRealtimeEvent<Reminder>("reminder", (r) => {
    setItems((list) => [...list.filter((x) => x.habitId !== r.habitId), r]);
    if (canNotify() && Notification.permission === "granted" && document.hidden) {
      const n = new Notification(`${r.emoji} ${r.name}`, { body: "Not done yet today. You've got this!", tag: `habit-${r.habitId}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  });

  const close = (id: number) => setItems((list) => list.filter((x) => x.habitId !== id));

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:top-6 sm:right-6 sm:items-end"
    >
      {items.map((r) => (
        <ReminderToast key={r.habitId} reminder={r} onClose={() => close(r.habitId)} />
      ))}
    </div>
  );
}

function ReminderToast({ reminder: r, onClose }: { reminder: Reminder; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const id = setTimeout(() => close.current(), 60_000);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm animate-pop items-center gap-3 rounded-2xl border border-primary/30 bg-surface-strong/95 p-3 pr-2 shadow-card backdrop-blur-xl"
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-2xl" aria-hidden="true">
        {r.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">Reminder</p>
        <p className="truncate font-bold">{r.name}</p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={async () => {
          await setHabitDay(r.habitId, r.day, true).catch(() => {});
          onClose();
        }}
      >
        <Check className="h-4 w-4" aria-hidden="true" /> Done
      </Button>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-text"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
