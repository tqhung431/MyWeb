"use client";

// Stage 27: the admin's short message at the top of every page ("Nook restarts at 9 pm"), and a note for someone the
// admin paused. The banner arrives live when the admin changes it; it can be hidden until it changes.

import { Megaphone, PauseCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMe } from "@/features/me/MeProvider";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { useT } from "@/lib/i18n/I18nProvider";

const HIDDEN_KEY = "nook.banner.hidden";

export function Banner({ initialText }: { initialText: string | null }) {
  const t = useT();
  const { user } = useMe();
  const [text, setText] = useState<string | null>(initialText);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => setText(initialText), [initialText]);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(HIDDEN_KEY));
    } catch {}
  }, []);
  useRealtimeEvent<{ text: string | null }>("banner:changed", (b) => setText(b.text));

  const paused = user?.pausedUntil && new Date(user.pausedUntil).getTime() > Date.now();
  return (
    <>
      {text && hidden !== text && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 font-semibold break-words">{text}</p>
          <button
            type="button"
            aria-label={t("Hide")}
            className="cursor-pointer rounded-full p-0.5 text-muted hover:text-text"
            onClick={() => {
              setHidden(text);
              try {
                localStorage.setItem(HIDDEN_KEY, text);
              } catch {}
            }}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {paused && (
        <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-500/12 px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-200">
          <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("The admin paused you for now. You can still read everything.")}
        </div>
      )}
    </>
  );
}
