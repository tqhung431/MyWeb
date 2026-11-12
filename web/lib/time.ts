import { currentLang, LOCALE, tNow as t } from "@/lib/i18n/core";

// "just now", "5 min ago", "3 h ago", "yesterday", "12 Mar" (Stage 21: in the page's language)
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 45) return t("just now");
  if (s < 3600) return t("{n} min ago", { n: Math.round(s / 60) });
  if (s < 86_400) return t("{n} h ago", { n: Math.round(s / 3600) });
  if (s < 2 * 86_400) return t("yesterday");
  if (s < 7 * 86_400) return t("{n} days ago", { n: Math.floor(s / 86_400) });
  return new Date(iso).toLocaleDateString(LOCALE[currentLang()], { day: "numeric", month: "short" });
}

// "14:05" for chat bubbles
export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(LOCALE[currentLang()], { hour: "2-digit", minute: "2-digit" });
}
