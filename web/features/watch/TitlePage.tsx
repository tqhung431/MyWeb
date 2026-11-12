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

import { useT } from "@/lib/i18n/I18nProvider";
export function TitlePage({ id }: { id: number }) {
  const t = useT();
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

  if (missing) return <p className="text-sm text-muted">{t("This title isn't on anyone's list (any more).")}</p>;
  if (!data) return <p className="text-sm text-muted">{t("Loading…")}</p>;
  const show = data.title;

  async function change(s: Status | "remove") {
    if (!user) return askName();
    if (s === "remove") await removeEntry(show.id).catch(() => {});
    else await saveEntry(show.source, show.externalId, { status: s }).catch(() => {});
    void load();
  }
  async function rate(stars: number | null) {
    if (!data?.mine) return;
    await saveEntry(show.source, show.externalId, { status: data.mine.status, stars }).catch(() => {});
    void load();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/watchlist" className={buttonClasses("ghost", "sm", "-ml-3 self-start")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("My list")}
      </Link>
      <section className="flex flex-col gap-6 sm:flex-row">
        <Poster src={show.imageUrl} title={show.title} source={show.source} className="w-40 shrink-0 self-start sm:w-48" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{show.title}</h2>
            {show.originalTitle && <p className="text-muted">{show.originalTitle}</p>}
            <p className="mt-1 text-sm text-muted">
              {[show.year, show.kind, show.episodes ? t("{n} episodes", { n: show.episodes }) : null].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {show.rating !== null && (
              <Badge tone="primary">
                ★ {t("{rating} on {site}", { rating: (show.rating / 10).toFixed(1), site: show.source === "tv" ? "TVmaze" : "MyAnimeList" })}
              </Badge>
            )}
            {show.genres.map((g) => (
              <Badge key={g}>{g}</Badge>
            ))}
          </div>
          {show.summary && <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-line">{show.summary}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <StatusSelect value={data.mine?.status ?? null} onChange={change} allowRemove={!!data.mine} />
            {data.mine && <Stars value={data.mine.stars} onChange={rate} />}
            {show.url && (
              <a href={show.url} target="_blank" rel="noopener noreferrer" className={buttonClasses("ghost", "sm")}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> {show.source === "tv" ? "TVmaze" : "MyAnimeList"}
              </a>
            )}
          </div>
        </div>
      </section>

      <Card>
        <CardHeader
          title={t("On Nook")}
          subtitle={data.people.length === 1 ? t("1 person has this on their list") : t("{n} people have this on their list", { n: data.people.length })}
        />
        <ul className="flex flex-col divide-y divide-border">
          {data.people.map((p) => (
            <li key={p.name} className="flex gap-3 py-3">
              <Avatar name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <strong>{p.name}</strong>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{t(STATUS_LABEL[p.status])}</span>
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
