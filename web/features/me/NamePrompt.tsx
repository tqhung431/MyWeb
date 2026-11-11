"use client";

// "What should we call you?": shown on your first visit (Stage 11: no sign-up, no password).
// "Not now" hides it until the browser is closed; Hobby Hub and the You page ask again when needed.

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { User } from "@/lib/api/me";
import { NameForm } from "./NameForm";

export function NamePrompt({ onDone, onLater }: { onDone: (user: User) => void; onLater: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLater]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center">
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="relative w-full max-w-md animate-pop rounded-3xl border border-border bg-surface-strong p-6 shadow-card sm:p-8"
      >
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-9 w-9" onClick={onLater} aria-label="Not now">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-5xl" aria-hidden="true">
          👋
        </p>
        <h2 id="name-prompt-title" className="mt-3 text-2xl font-bold tracking-tight">
          What should we call you?
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">
          Just a name, so everyone here knows who&apos;s who in Hobby Hub, the leaderboards and the live feed. No email, no password.
        </p>
        <NameForm mode="pick" onDone={onDone} autoFocus />
        <p className="mt-4 text-xs text-muted">Nook remembers you on this browser only. Clearing its data, or another device, means picking a name again.</p>
        <button type="button" onClick={onLater} className="mt-3 cursor-pointer text-sm font-semibold text-muted hover:text-text">
          Not now
        </button>
      </div>
    </div>
  );
}
