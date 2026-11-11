// Home: the hub for every Nook app. The grid is built from lib/apps.ts,
// so a new app appears here as soon as it's added to the registry.

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Greeting } from "@/components/shell/Greeting";
import { AppIcon } from "@/components/ui/AppIcon";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/ui/Button";
import { TodayStats } from "@/features/focus/TodayStats";
import { LiveNow } from "@/features/realtime/LiveNow";
import { APPS, type AppInfo } from "@/lib/apps";
import { cn } from "@/lib/cn";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div>
          <Greeting />
          <p className="mt-2 max-w-xl text-muted">
            A calm corner of the web for your free time. Pick up where you left off, or try something new.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/chill" className={buttonClasses("primary", "lg")}>
            Start focusing
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
          <Link href="/chill/tips" className={buttonClasses("secondary", "lg")}>
            Read a tip
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-labelledby="today-title">
          <h2 id="today-title" className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">
            Today
          </h2>
          <TodayStats />
        </section>
        <LiveNow />
      </div>

      <section aria-labelledby="apps-title">
        <h2 id="apps-title" className="mb-3 text-sm font-semibold tracking-wider text-muted uppercase">
          Your apps
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {APPS.map((app) => (
            <li key={app.id}>
              <AppTile app={app} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AppTile({ app }: { app: AppInfo }) {
  const live = app.status === "live";
  const body = (
    <>
      <div className="flex items-start justify-between">
        <AppIcon icon={app.icon} accent={app.accent} size="lg" muted={!live} />
        {live ? <Badge tone="success">Live</Badge> : <Badge>Soon · {app.phase}</Badge>}
      </div>
      <div className="mt-5">
        <h3 className="font-bold">{app.name}</h3>
        <p className="mt-1 text-sm text-muted">{app.tagline}</p>
      </div>
    </>
  );

  const classes = cn(
    "block h-full rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl transition",
    live
      ? "hover:-translate-y-1 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      : "opacity-75",
  );

  return live ? (
    <Link href={app.href} className={classes}>
      {body}
    </Link>
  ) : (
    <div aria-disabled="true" className={classes}>
      {body}
    </div>
  );
}
