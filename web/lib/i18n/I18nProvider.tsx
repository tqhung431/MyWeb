"use client";

// Stage 21: gives every Client Component the page's language: const t = useT(); t("Send")
// The root layout passes the dictionary (empty for English).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { LANG_COOKIE, makeT, setCurrent, type Dict, type Lang, type T } from "./core";

const I18nContext = createContext<{ lang: Lang; t: T }>({ lang: "en", t: makeT({}) });

export function I18nProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: ReactNode }) {
  if (typeof window !== "undefined") setCurrent(lang, dict); // for tNow() in the browser
  const value = useMemo(() => ({ lang, t: makeT(dict) }), [lang, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = () => useContext(I18nContext).t;
export const useLang = () => useContext(I18nContext).lang;

// Settings → Language: remember it for a year, then reload so the server renders everything in it
export function saveLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  location.reload();
}
