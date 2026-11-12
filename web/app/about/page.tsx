import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

import { getT } from "@/lib/i18n/server";
import { tx } from "@/lib/i18n/core";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("About") };
}

const CREDITS = [
  [
    tx("Music & sounds"),
    tx(
      "All 11 sound tracks (lo-fi beats, piano, rain, forest...) are composed and generated live by our own code with the Web Audio API. No recordings, nothing to license.",
    ),
  ],
  [
    tx("Music app"),
    tx("Songs are uploaded by people who may share them, with their licence and credit shown. Starter pack: Creative Commons songs from ccMixter."),
  ],
  [tx("Icons"), "Lucide (ISC licence)"],
  [tx("Font"), "Plus Jakarta Sans (SIL Open Font License), self-hosted by Next.js"],
  [tx("Framework"), "Next.js, React (MIT) · TypeScript (Apache-2.0) · Tailwind CSS (MIT)"],
  [
    tx("API & data"),
    "Express, Zod, Drizzle ORM, node-postgres, cookie-parser, BullMQ, ioredis, Socket.IO · PostgreSQL (PostgreSQL Licence) · Valkey (BSD) · Caddy (Apache-2.0)",
  ],
];

export default async function AboutPage() {
  const t = await getT();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("About Nook")}</h1>
        <p className="mt-2 text-muted">
          {t("A learning project that grows one stage at a time, from a single HTML page to a full system with an API, a database, real-time features and AI.")}
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-bold">{t("How it fits together")}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>
            <strong className="text-text">{t("Website")}</strong>:{" "}
            {t("Next.js. Pages are Server Components; interactive parts (timer, sounds) are Client Components.")}
          </li>
          <li>
            <strong className="text-text">API</strong>: {t("Express. Checks every input and is the only part that talks to the database.")}
          </li>
          <li>
            <strong className="text-text">{t("Database")}</strong>: {t("PostgreSQL. Stores everything you make on Nook.")}
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{t("Credits and licences")}</h2>
        <dl className="mt-3 divide-y divide-border">
          {CREDITS.map(([term, detail]) => (
            <div key={term} className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold">{t(term)}</dt>
              <dd className="text-muted">{t(detail)}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="text-sm text-muted">
        {t("Curious how Nook is built?")}{" "}
        <Link href="/design" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("See the design system")}
        </Link>{" "}
        {t("with every colour theme and component, or")}{" "}
        <Link href="/developers" className="font-semibold text-primary underline-offset-4 hover:underline">
          {t("the API docs")}
        </Link>
        .
      </p>
    </div>
  );
}
