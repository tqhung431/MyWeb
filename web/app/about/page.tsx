import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "About" };

const CREDITS = [
  [
    "Music & sounds",
    "All 11 sound tracks (lo-fi beats, piano, rain, forest...) are composed and generated live by our own code with the Web Audio API. No recordings, nothing to license.",
  ],
  ["Music app", "Songs are uploaded by people who may share them, with their licence and credit shown. Starter pack: Creative Commons songs from ccMixter."],
  ["Icons", "Lucide (ISC licence)"],
  ["Font", "Plus Jakarta Sans (SIL Open Font License), self-hosted by Next.js"],
  ["Framework", "Next.js, React (MIT) · TypeScript (Apache-2.0) · Tailwind CSS (MIT)"],
  [
    "API & data",
    "Express, Zod, Drizzle ORM, node-postgres, cookie-parser, BullMQ, ioredis, Socket.IO · PostgreSQL (PostgreSQL Licence) · Valkey (BSD) · Caddy (Apache-2.0)",
  ],
];

export default function AboutPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">About Nook</h1>
        <p className="mt-2 text-muted">
          A learning project that grows one stage at a time, from a single HTML page to a full system with an API, a database, real-time features and AI.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-bold">How it fits together</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
          <li>
            <strong className="text-text">Website</strong>: Next.js. Pages are Server Components; interactive parts (timer, sounds) are Client Components.
          </li>
          <li>
            <strong className="text-text">API</strong>: Express. Checks every input and is the only part that talks to the database.
          </li>
          <li>
            <strong className="text-text">Database</strong>: PostgreSQL. Stores tips and your focus sessions.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">Credits and licences</h2>
        <dl className="mt-3 divide-y divide-border">
          {CREDITS.map(([term, detail]) => (
            <div key={term} className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold">{term}</dt>
              <dd className="text-muted">{detail}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <p className="text-sm text-muted">
        Curious how Nook is built?{" "}
        <Link href="/design" className="font-semibold text-primary underline-offset-4 hover:underline">
          See the design system
        </Link>{" "}
        with every colour theme and component.
      </p>
    </div>
  );
}
