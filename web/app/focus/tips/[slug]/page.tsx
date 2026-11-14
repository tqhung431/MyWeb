// "/focus/tips/[slug]" — one tip, rendered per request from the database.

import { ArrowLeft, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getTip } from "@/lib/api/tips";

import { getT } from "@/lib/i18n/server";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tip = await getTip((await params).slug);
  return { title: tip?.title ?? (await getT())("Tip not found") };
}

export default async function TipPage({ params }: Props) {
  const t = await getT();
  const tip = await getTip((await params).slug); // GET /api/tips/:slug
  if (!tip) notFound();

  return (
    <div className="max-w-2xl">
      <Link href="/focus/tips" className={buttonClasses("ghost", "sm", "-ml-3 mb-4")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("All tips")}
      </Link>
      <Card>
        <article>
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {t("Takes about {n} min", { n: tip.minutes })}
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{tip.title}</h2>
          <p className="mt-2 text-lg text-muted">{tip.summary}</p>
          <div className="mt-6 space-y-4 leading-relaxed">
            {tip.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
      </Card>
    </div>
  );
}
