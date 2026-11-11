// "/tips/[slug]" — a dynamic route. The folder name [slug] becomes a URL parameter:
// /tips/real-breaks → params.slug === "real-breaks".
// Stage 2 built these pages ahead of time; now they're rendered per request from the database.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTip } from "@/lib/api";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tip = await getTip((await params).slug);
  return { title: tip ? `${tip.title} · Chill Corner` : "Tip not found" };
}

export default async function TipPage({ params }: Props) {
  const tip = await getTip((await params).slug); // GET /api/tips/:slug
  if (!tip) notFound(); // the API said 404 → show our 404 page

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
