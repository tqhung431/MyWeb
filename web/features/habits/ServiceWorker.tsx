"use client";

// Registers public/sw.js (Stage 13), so the Habit Tracker opens without a connection.
// Browsers only allow service workers on secure pages (https://, or http://localhost), and we skip it in
// development, where files change all the time.

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
