// "/tips/[slug]" — a dynamic route. The folder name [slug] becomes a URL parameter:
// /tips/real-breaks → params.slug === "real-breaks".

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTip, tips } from "@/lib/tips";

type Props = { params: Promise<{ slug: string }> };

// Build every tip page ahead of time (static generation), at `npm run build`.
export function generateStaticParams() {
  return tips.map((tip) => ({ slug: tip.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tip = getTip((await params).slug);
  return { title: tip ? `${tip.title} · Chill Corner` : "Tip not found" };
}

export default async function TipPage({ params }: Props) {
  const tip = getTip((await params).slug);
  if (!tip) notFound(); // shows the 404 page

  return (
    <article className="prose">
      <p>
        <Link href="/tips">← All tips</Link>
      </p>
      <h1>{tip.title}</h1>
      <span className="badge">Takes about {tip.minutes} min</span>
      {tip.body.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
    </article>
  );
}
