// Stage 21: the visitor's language in Server Components (pages, layouts, metadata).
import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, makeT, pickLang, type Dict, type Lang, type T } from "./core";
import vi from "./vi.json";

const DICTS: Record<Lang, Dict> = { en: {}, vi };

export async function getLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return pickLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}

export const dictFor = (lang: Lang): Dict => DICTS[lang];

export async function getT(): Promise<T> {
  return makeT(DICTS[await getLang()]);
}
