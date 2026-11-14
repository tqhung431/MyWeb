"use client";

// Stage 27: the Admin page (/admin). Only for a browser that typed the admin passcode (for 12 hours).
//   People  · rename, a sign-in code for someone locked out, sign out everywhere, pause, delete
//   Reports · what people reported: keep it or delete it (the admin never sees whole private chats)
//   Content · lock Hobby Hub groups, remove songs, remove leaderboard scores
//   Nook    · the banner on every page, storage, run the cleanup, the admin log
//   Health  · is everything working (instead of commands on screen)
// Everything here is written to the admin log.

import { Activity, Flag, Library, Loader2, Lock, LockOpen, Megaphone, ShieldCheck, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useMe } from "@/features/me/MeProvider";
import * as A from "@/lib/api/admin";
import { getAdmin } from "@/lib/api/arena";
import { ApiError } from "@/lib/api/client";
import { getGroups, type Group } from "@/lib/api/hobby";
import { getCharts, type ChartSong } from "@/lib/api/music";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";

type Tab = "people" | "reports" | "content" | "nook" | "health";
const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`);

export function AdminPage() {
  const t = useT();
  const { user } = useMe();
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("people");
  useEffect(() => {
    getAdmin().then(
      (s) => setOk(s.isAdmin),
      () => setOk(false),
    );
  }, [user?.id]);

  if (ok === null) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  if (!ok)
    return (
      <Card className="max-w-lg">
        <CardHeader title={t("Admin")} subtitle={t("Only the admin can open this page.")} />
        <Link href="/settings#admin" className={buttonClasses("primary", "md")}>
          {t("Become admin in Settings")}
        </Link>
      </Card>
    );

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "people", label: t("People"), icon: Users },
    { id: "reports", label: t("Reports"), icon: Flag },
    { id: "content", label: t("Content"), icon: Library },
    { id: "nook", label: t("Nook"), icon: Megaphone },
    { id: "health", label: t("Health"), icon: Activity },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-8 w-8 text-emerald-500" aria-hidden="true" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("Admin")}</h1>
          <p className="text-sm text-muted">{t("Everything you do here is written to the admin log.")}</p>
        </div>
      </div>
      <div role="tablist" aria-label={t("Admin")} className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === id ? "bg-primary text-on-primary" : "bg-surface-muted text-muted hover:text-text",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      {tab === "people" && <PeopleTab />}
      {tab === "reports" && <ReportsTab />}
      {tab === "content" && <ContentTab />}
      {tab === "nook" && <NookTab />}
      {tab === "health" && <HealthTab />}
    </div>
  );
}

function useAsync<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(() => {
    load().then(setData, (e) => setError(e instanceof ApiError ? e.message : "That didn't work"));
  }, [load]);
  useEffect(reload, [reload]);
  return { data, error, reload };
}
const Err = ({ text }: { text: string }) =>
  text ? (
    <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
      {text}
    </p>
  ) : null;

// --- People ------------------------------------------------------------------------------------------

function PeopleTab() {
  const t = useT();
  const { user } = useMe();
  const { data: people, error, reload } = useAsync(A.getPeople);
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(40);
  if (!people) return error ? <Err text={error} /> : <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  const matching = people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const shown = matching.slice(0, limit);
  return (
    <div className="flex flex-col gap-3">
      <Input label={t("Find someone")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Name")} className="max-w-sm" />
      <p className="text-sm text-muted">{t("{n} people", { n: people.length })}</p>
      <ul className="flex flex-col gap-2">
        {shown.map((p) => (
          <PersonRow key={p.id} p={p} me={p.id === user?.id} onChange={reload} />
        ))}
      </ul>
      {matching.length > limit && (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setLimit((n) => n + 40)}>
          {t("Show more ({n} left)", { n: matching.length - limit })}
        </Button>
      )}
    </div>
  );
}

function PersonRow({ p, me, onChange }: { p: A.AdminPerson; me: boolean; onChange: () => void }) {
  const t = useT();
  const confirm = useConfirm();
  const [open, setOpen] = useState<null | "rename" | "delete" | "code">(null);
  const [managing, setManaging] = useState(false);
  const [text, setText] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      setOpen(null);
      onChange();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("That didn't work"));
    }
  };
  return (
    <li className="rounded-2xl border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 truncate font-bold">
          {p.name} {me && <span className="text-xs font-semibold text-primary">({t("you")})</span>}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            p.hasPin ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
          )}
        >
          {p.hasPin ? t("PIN set") : t("No PIN yet")}
        </span>
        {p.pausedUntil && <span className="rounded-full bg-rose-500/12 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">{t("Paused")}</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-muted">
          {t("Joined {when}", { when: timeAgo(p.createdAt) })} · {t("Last seen {when}", { when: timeAgo(p.lastSeenAt) })} · {(p.devices === 1 ? t("1 device") : t("{n} devices", { n: p.devices }))}
        </p>
        <Button variant={managing ? "secondary" : "ghost"} size="sm" onClick={() => (setManaging(!managing), setOpen(null))} aria-expanded={managing}>
          {t("Manage")}
        </Button>
      </div>
      {managing && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => (setText(p.name), setOpen(open === "rename" ? null : "rename"))}>
            {t("Rename")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              run(async () => {
                const c = await A.claimCode(p.id);
                setCode(c.code);
              }).then(() => setOpen("code"))
            }
          >
            {t("Sign-in code")}
          </Button>
          {!me && (
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                if (await confirm({ title: t("Sign {name} out everywhere?", { name: p.name }), confirmLabel: t("Sign out") }))
                  void run(() => A.signOutPerson(p.id));
              }}
            >
              {t("Sign out everywhere")}
            </Button>
          )}
          {!me &&
            (p.pausedUntil ? (
              <Button variant="secondary" size="sm" onClick={() => run(() => A.pausePerson(p.id, 0))}>
                {t("Lift the pause")}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => run(() => A.pausePerson(p.id, 1))}>
                  {t("Pause 1 day")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(() => A.pausePerson(p.id, 7))}>
                  {t("Pause 7 days")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => run(() => A.pausePerson(p.id, 3650))}>
                  {t("Pause until lifted")}
                </Button>
              </>
            ))}
          {!me && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (setText(""), setOpen(open === "delete" ? null : "delete"))}
              className="text-rose-600 dark:text-rose-400"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("Delete")}
            </Button>
          )}
        </div>
      )}
      {open === "rename" && (
        <form
          className="mt-2 flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => A.renamePerson(p.id, text));
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={30}
            aria-label={t("New name")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-strong px-3"
          />
          <Button type="submit" size="sm" variant="primary" disabled={!text.trim()}>
            {t("Save")}
          </Button>
        </form>
      )}
      {open === "code" && code && (
        <div className="mt-2 rounded-2xl bg-primary/8 p-3">
          <p className="text-sm">
            {t("Give this code to {name}. It works once, for 24 hours. Their old PIN stops working, and they choose a new one.", { name: p.name })}
          </p>
          <p className="mt-1 font-mono text-2xl font-extrabold tracking-[0.25em]">{code}</p>
        </div>
      )}
      {open === "delete" && (
        <form
          className="mt-2 flex max-w-md flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => A.deletePerson(p.id, text));
          }}
        >
          <p className="text-sm text-rose-700 dark:text-rose-300">
            {t("This deletes {name} and everything they made. It can't be undone. Type their name to confirm.", { name: p.name })}
          </p>
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={t("Their name")}
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface-strong px-3"
            />
            <Button type="submit" size="sm" variant="danger" disabled={text.trim().toLowerCase() !== p.name.toLowerCase()}>
              {t("Delete")}
            </Button>
          </div>
        </form>
      )}
      <Err text={error} />
    </li>
  );
}

// --- Reports -----------------------------------------------------------------------------------------

function ReportsTab() {
  const t = useT();
  const [status, setStatus] = useState<"open" | "kept" | "deleted">("open");
  const load = useCallback(() => A.getReports(status), [status]);
  const { data, error, reload } = useAsync(load);
  const kindLabel: Record<A.Report["kind"], string> = { post: t("Post"), comment: t("Comment"), message: t("Group chat"), dm: t("Private message") };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        {(["open", "kept", "deleted"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "primary" : "ghost"} onClick={() => setStatus(s)}>
            {s === "open" ? t("To look at") : s === "kept" ? t("Kept") : t("Deleted")}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted">{t("You only see what someone reported. Private chats are never shown to the admin, only a reported message.")}</p>
      <Err text={error} />
      {data?.length === 0 && <p className="text-sm text-muted">{t("Nothing here.")}</p>}
      <ul className="flex flex-col gap-2">
        {data?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-surface p-3">
            <p className="text-xs font-semibold text-muted">
              {kindLabel[r.kind]} · {r.where} · {t("by {name}", { name: r.authorName })} · {timeAgo(r.createdAt)}
            </p>
            <p className="mt-1 text-sm break-words whitespace-pre-wrap">{r.excerpt || (r.hasPicture ? t("(a picture)") : "")}</p>
            {r.hasPicture && r.excerpt && <p className="text-xs text-muted">{t("+ a picture")}</p>}
            <p className="mt-1 text-xs text-muted">
              {t("Reported by {name}", { name: r.reporter })}
              {r.reason && <>: “{r.reason}”</>}
            </p>
            {status === "open" && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="danger" onClick={() => A.settleReport(r.id, "delete").then(reload, () => {})}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("Delete it")}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => A.settleReport(r.id, "keep").then(reload, () => {})}>
                  {t("Keep it")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Content -----------------------------------------------------------------------------------------

function ContentTab() {
  const t = useT();
  const confirm = useConfirm();
  const groups = useAsync(getGroups);
  const loadSongs = useCallback(() => getCharts("all", "all", { limit: 200 }), []);
  const songs = useAsync<ChartSong[]>(loadSongs);
  const scores = useAsync(A.getScores);
  const [q, setQ] = useState("");
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title={t("Hobby Hub groups")}
          subtitle={t("A locked group can be read, but nobody can post or chat. Posts and messages can be deleted right in Hobby Hub.")}
        />
        <ul className="flex flex-col gap-1.5">
          {groups.data?.map((g: Group) => (
            <li key={g.slug} className="flex items-center gap-2 text-sm">
              <span aria-hidden="true">{g.emoji}</span>
              <Link href={`/hobby-hub/${g.slug}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
                {g.name}
              </Link>
              <Button size="sm" variant={g.locked ? "primary" : "ghost"} onClick={() => A.lockGroup(g.slug, !g.locked).then(groups.reload, () => {})}>
                {g.locked ? <LockOpen className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}{" "}
                {g.locked ? t("Unlock") : t("Lock")}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t("Leaderboard scores")} subtitle={t("Remove a score that can't be right.")} />
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {scores.data?.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted">{s.game}</span>
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="font-mono font-bold">{s.score}</span>
              <Button size="sm" variant="ghost" aria-label={t("Remove")} onClick={() => A.deleteScore(s.id).then(scores.reload, () => {})}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
          {scores.data?.length === 0 && <p className="text-sm text-muted">{t("Nothing here.")}</p>}
        </ul>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title={t("Songs")} subtitle={t("Removing a song deletes its file too.")} />
        <Input label={t("Find a song")} value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 max-w-sm" />
        <ul className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {songs.data
            ?.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase()))
            .map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{s.title}</span> <span className="text-muted">· {s.artist}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t("Remove")}
                  onClick={async () => {
                    if (await confirm({ title: t("Remove “{title}”?", { title: s.title }), confirmLabel: t("Remove"), danger: true }))
                      A.deleteSongAsAdmin(s.id).then(songs.reload, () => {});
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  );
}

// --- Nook --------------------------------------------------------------------------------------------

function NookTab() {
  const t = useT();
  const banner = useAsync(A.getBanner);
  const storage = useAsync(A.getStorage);
  const log = useAsync(A.getLog);
  const [text, setText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const value = text ?? banner.data?.text ?? "";
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title={t("Banner")} subtitle={t("A short message at the top of every page, for everyone.")} />
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void A.setBanner(value).then(() => (setNote(value ? t("The banner is up.") : t("The banner is gone.")), banner.reload(), log.reload()));
          }}
        >
          <Input label={t("Message")} value={value} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder={t("e.g. Nook restarts at 9 pm")} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="primary">
              {t("Save")}
            </Button>
            {banner.data?.text && (
              <Button type="button" size="sm" variant="ghost" onClick={() => A.setBanner("").then(() => (setText(""), banner.reload(), log.reload()))}>
                {t("Remove the banner")}
              </Button>
            )}
          </div>
          {note && <p className="text-sm text-emerald-600 dark:text-emerald-400">{note}</p>}
        </form>
      </Card>
      <Card>
        <CardHeader title={t("Storage")} />
        {storage.data ? (
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">{t("Songs")}</dt>
            <dd>{bytes(storage.data.songs.bytes)}</dd>
            <dt className="text-muted">{t("Chat pictures")}</dt>
            <dd>
              {bytes(storage.data.pictures.bytes)} · {t("{n} files", { n: storage.data.pictures.files })}
            </dd>
            {storage.data.disk && (
              <>
                <dt className="text-muted">{t("Free disk space")}</dt>
                <dd>
                  {bytes(storage.data.disk.free)} / {bytes(storage.data.disk.total)}
                </dd>
              </>
            )}
          </dl>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />
        )}
        <Button
          className="mt-3"
          size="sm"
          variant="secondary"
          onClick={() =>
            A.runCleanup().then(
              () => (setNote(t("The cleanup is running.")), log.reload()),
              () => {},
            )
          }
        >
          {t("Run the cleanup now")}
        </Button>
        <p className="mt-1 text-xs text-muted">{t("It runs every day anyway: people not seen for 90 days, chat older than 30 days, unused pictures.")}</p>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title={t("Admin log")} subtitle={t("Kept for 90 days.")} />
        <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto text-sm">
          {log.data?.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-2 border-b border-border/60 py-1">
              <span className="w-28 shrink-0 text-xs text-muted tabular-nums">{new Date(l.at).toLocaleString()}</span>
              <span className="font-semibold">{l.byName}</span>
              <span>{t(l.action)}</span>
              {l.detail && <span className="min-w-0 truncate text-muted">· {l.detail}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// --- Health ------------------------------------------------------------------------------------------

function HealthTab() {
  const t = useT();
  const { data, reload } = useAsync(A.getHealth);
  if (!data) return <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />;
  const rows: { name: string; state: string; help: ReactNode }[] = [
    { name: t("Database"), state: data.database, help: "docs/stage-3.md" },
    { name: "Valkey", state: data.valkey, help: "docs/stage-5.md" },
    { name: t("Game server (Nook Arena)"), state: data.gameServer, help: "docs/stage-22.md" },
    { name: t("AI (Free-time Companion)"), state: data.ai, help: "docs/stage-9.md" },
  ];
  const label: Record<string, string> = {
    working: t("Working"),
    "not reachable": t("Not reachable"),
    off: t("Switched off"),
    "getting ready": t("Getting ready"),
  };
  return (
    <Card>
      <CardHeader title={t("Health")} subtitle={t("What's working right now. When something isn't, its page in the docs folder says what to check.")} />
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                r.state === "working" ? "bg-emerald-500" : r.state === "off" ? "bg-slate-400" : r.state === "getting ready" ? "bg-amber-500" : "bg-rose-500",
              )}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 font-semibold">{r.name}</span>
            <span>{label[r.state] ?? r.state}</span>
            {r.state !== "working" && r.state !== "off" && <span className="w-full pl-4 text-xs text-muted">{t("See {doc}", { doc: String(r.help) })}</span>}
          </li>
        ))}
        {data.disk && (
          <li className="flex items-center gap-2 text-sm">
            <span className={cn("h-2.5 w-2.5 rounded-full", data.disk.free < 2e9 ? "bg-rose-500" : data.disk.free / data.disk.total < 0.1 ? "bg-amber-500" : "bg-emerald-500")} aria-hidden="true" />
            <span className="flex-1 font-semibold">{t("Disk")}</span>
            <span>{t("{free} free", { free: bytes(data.disk.free) })}</span>
          </li>
        )}
      </ul>
      <Button className="mt-3" size="sm" variant="secondary" onClick={reload}>
        {t("Check again")}
      </Button>
    </Card>
  );
}
