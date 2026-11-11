// "/tips" — a Server Component. On every request, the Next.js server asks the API for tips,
// then sends finished HTML. The browser never talks to the database.

import type { Metadata } from "next";
import Link from "next/link";
import { getTips } from "@/lib/api";

export const metadata: Metadata = { title: "Focus tips · Chill Corner" };

export default async function TipsPage() {
  const tips = await getTips(); // GET http://localhost:4000/api/tips

  return (
    <div className="prose">
      <h1>Focus tips</h1>
      <p className="hint">Short ideas to make each session count. Your timer keeps running while you read.</p>
      <ul className="tip-list">
        {tips.map((tip) => (
          <li key={tip.slug}>
            <Link href={`/tips/${tip.slug}`}>
              <strong>{tip.title}</strong>
              <p className="hint">{tip.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
