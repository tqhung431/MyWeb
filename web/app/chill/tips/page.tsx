// "/chill/tips" — Server Component: asks the API on every request, sends finished HTML.

import type { Metadata } from "next";
import { TipCard } from "@/features/tips/TipCard";
import { getTips } from "@/lib/api/tips";

export const metadata: Metadata = { title: "Focus tips" };

export default async function TipsPage() {
  const tips = await getTips(); // GET /api/tips

  return (
    <section aria-label="Focus tips">
      <p className="mb-4 text-muted">Short ideas to make each session count. Your timer keeps running while you read.</p>
      <ul className="grid gap-4 md:grid-cols-2">
        {tips.map((tip) => (
          <li key={tip.slug}>
            <TipCard tip={tip} />
          </li>
        ))}
      </ul>
    </section>
  );
}
