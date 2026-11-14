import { ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { TipSummary } from "@/lib/api/tips";

type Props = { tip: TipSummary; eyebrow?: string };

export function TipCard({ tip, eyebrow }: Props) {
  return (
    <Link
      href={`/focus/tips/${tip.slug}`}
      className="group flex items-start gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-600 dark:text-amber-300">
        <Lightbulb className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        {eyebrow && <span className="mb-1 block text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</span>}
        <span className="block font-semibold">{tip.title}</span>
        <span className="mt-1 block text-sm text-muted">{tip.summary}</span>
        <span className="mt-3 block">
          <Badge>{tip.minutes} min</Badge>
        </span>
      </span>
      <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}
