// "/focus/tips" — Server Component: asks the API on every request, sends finished HTML.

import type { Metadata } from "next";
import { TipCard } from "@/features/tips/TipCard";
import { getTips } from "@/lib/api/tips";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Focus tips") };
}

export default async function TipsPage() {
  const t = await getT();
  const tips = await getTips(); // GET /api/tips

  return (
    <section aria-label={t("Focus tips")}>
      <p className="mb-4 text-muted">{t("Short ideas to make each session count. Your timer keeps running while you read.")}</p>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tips.map((tip) => (
          <li key={tip.slug}>
            <TipCard tip={tip} />
          </li>
        ))}
      </ul>
    </section>
  );
}
