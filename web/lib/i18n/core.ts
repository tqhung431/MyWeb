// Stage 21: Nook in English or Vietnamese.
//
// How it works (no library, ~60 lines):
//   - The English text IS the key: t("Pick a name") → "Chọn tên" in Vietnamese, "Pick a name" in English.
//     So English needs no dictionary, and code stays readable.
//   - vi.json holds every Vietnamese text. Only the server reads it (server.ts); the browser gets it from
//     the page only when you use Vietnamese, so English pages don't carry it.
//   - A test (tests/i18n.test.ts) finds every t("…") and tx("…") in the code and fails if one has no
//     Vietnamese text.
//   - {name} in a text is filled in: t("Message {name}", { name: "Mai" }).
//   - Plurals: write both forms; Vietnamese has one: n === 1 ? t("1 member") : t("{n} members", { n }).
//   - Your choice is the "nook_lang" cookie, so the server renders pages in your language from the start.
//     No cookie yet: the browser's language (Accept-Language) decides.

export type Lang = "en" | "vi";
export const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "vi", label: "Tiếng Việt" },
];
export const LANG_COOKIE = "nook_lang";
export type Params = Record<string, string | number>;
export type T = (text: string, params?: Params) => string;
export type Dict = Record<string, string>;

export const isLang = (v: unknown): v is Lang => v === "en" || v === "vi";

// The cookie wins; otherwise the first of the browser's languages that Nook has
export function pickLang(cookie: string | undefined, acceptLanguage: string | null | undefined): Lang {
  if (isLang(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === "vi") return "vi";
    if (code === "en") return "en";
  }
  return "en";
}

export function translate(dict: Dict, text: string, params?: Params): string {
  const out = dict[text] ?? text;
  return params ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : out;
}

export const makeT =
  (dict: Dict): T =>
  (text, params) =>
    translate(dict, text, params);

// Marks a text in plain data (app names, game rules…) so the test finds it; it's translated where shown: t(app.tagline)
export const tx = (text: string) => text;

// For the browser's date and number formatting
export const LOCALE: Record<Lang, string> = { en: "en-GB", vi: "vi-VN" };

// For code outside React (time helpers, the game): the page's language, set by I18nProvider in the browser.
// On the server it stays English: server code uses getT() from server.ts instead.
let current: { lang: Lang; dict: Dict } = { lang: "en", dict: {} };
export const setCurrent = (lang: Lang, dict: Dict) => void (current = { lang, dict });
export const currentLang = () => current.lang;
export const tNow: T = (text, params) => translate(current.dict, text, params);
