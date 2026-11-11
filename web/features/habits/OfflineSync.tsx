"use client";

// Sends changes that were kept on this device while offline (lib/offline.ts):
// when the page opens, when the browser says it's back online, when you come back to the tab, and every
// 20 s while some are waiting. "Back online" often fires a moment before requests really work (on phones
// too), so a failed try is repeated a few times, a little later each time.

import { CloudUpload } from "lucide-react";
import { useEffect, useState } from "react";
import { flush, onWaitingChange, waitingCount } from "@/lib/offline";

export function OfflineSync() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    setWaiting(waitingCount());
    const off = onWaitingChange(setWaiting);
    let retry: ReturnType<typeof setTimeout> | undefined;
    const go = (attempt = 0) => {
      clearTimeout(retry);
      void flush().then(() => {
        if (waitingCount() > 0 && attempt < 5) retry = setTimeout(() => go(attempt + 1), 1500 * (attempt + 1));
      });
    };
    const onOnline = () => go();
    const onVisible = () => document.visibilityState === "visible" && waitingCount() > 0 && go();
    go();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => waitingCount() > 0 && go(), 20_000);
    return () => {
      off();
      clearTimeout(retry);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, []);

  if (!waiting) return null;
  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-3 z-30 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg lg:bottom-6 lg:left-auto lg:right-6"
      title="Saved on this device. Tap to send now."
    >
      <CloudUpload className="h-4 w-4" aria-hidden="true" /> {waiting} waiting to sync
    </button>
  );
}
