"use client";

// One show or anime: what it's about, and what everyone on Nook thinks of it.

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useMe } from "@/features/me/MeProvider";
import { removeEntry, saveEntry, STATUS_LABEL, getTitle, type Status, type TitleDetail } from "@/lib/api/watch";
import { timeAgo } from "@/lib/time";
import { Poster, Stars, StatusSelect, STATUS_TONE } from "./bits";

export function TitlePage({ id }: { id: number }) {
  const { user, askName } = useMe();
  const [data, setData] = useState<TitleDetail | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await getTitle(id));
    } catch {
      setMissing(true);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load, user?.id]);

  if (missing) return <p className="text-sm text-muted">This title isn&apos;t on anyone&apos;s list (any more).</p>;
  if (!data) return <p className="text-sm text-muted">Loading…</p>;
  const t = data.title;

  async function change(s: Status | "remove") {
    if (!user) return askName();
    if (s === "remove") await removeEntry(t.id).catch(() => {});
    else await saveEntry(t.source, t.externalId, { status: s }).catch(() => {});
    void load();
  }
  async function rate(stars: number | null) {
    if (!data?.mine) return;
    await saveEntry(t.source, t.externalId, { status: data.mine.status, stars }).catch(() => {});
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/watchlist" className={buttonClasses("ghost", "sm", "-ml-3 self-start")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My list
      </Link>
      <section className="flex flex-col gap-6 sm:flex-row">
        <Poster src={t.imageUrl} title={t.title} source={t.source} className="w-40 shrink-0 self-start sm:w-48" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h2>
            {t.originalTitle && <p className="text-muted">{t.originalTitle}</p>}
            <p className="mt-1 text-sm text-muted">{[t.year, t.kind, t.episodes ? `${t.episodes} episodes` : null].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {t.rating !== null && (
              <Badge tone="primary">
                ★ {(t.rating / 10).toFixed(1)} on {t.source === "tv" ? "TVmaze" : "MyAnimeList"}
              </Badge>
            )}
            {t.genres.map((g) => (
              <Badge key={g}>{g}</Badge>
            ))}
          </div>
          {t.summary && <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{t.summary}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <StatusSelect value={data.mine?.status ?? null} onChange={change} allowRemove={!!data.mine} />
            {data.mine && <Stars value={data.mine.stars} onChange={rate} />}
            {t.url && (
              <a href={t.url} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm")}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> {t.source === "tv" ? "TVmaze" : "MyAnimeList"}
              </a>
            )}
          </div>
        </div>
      </section>

      <Card>
        <CardHeader title="On Nook" subtitle={`${data.people.length} ${data.people.length === 1 ? "person has" : "people have"} this on their list`} />
        <ul className="flex flex-col divide-y divide-border">
          {data.people.map((p) => (
            <li key={p.name} className="flex gap-3 py-3">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <strong>{p.name}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  {p.stars && <Stars value={p.stars} size="sm" />}
                  <span className="text-xs text-muted">{timeAgo(p.updatedAt)}</span>
                </p>
                {p.note && <p className="mt-1 text-sm break-words text-muted">“{p.note}”</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
