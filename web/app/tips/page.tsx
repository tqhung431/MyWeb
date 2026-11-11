// "/tips" — a Server Component. It reads data on the server and sends finished HTML.
// No JavaScript for this list is sent to the browser.

import type { Metadata } from "next";
import Link from "next/link";
import { tips } from "@/lib/tips";

export const metadata: Metadata = { title: "Focus tips · Chill Corner" };

export default function TipsPage() {
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
