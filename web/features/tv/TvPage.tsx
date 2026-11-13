"use client";

// Stage 22: Nook TV. The admin puts YouTube videos and playlists on shelves; everyone watches them here.
// The player is YouTube's own embed from youtube-nocookie.com (no YouTube cookies until you press play).
// When the admin shares a browser tab, a "Live now" banner leads to /tv/live.

import { Loader2, Play, Plus, Radio, ShieldCheck, Trash2, Tv, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useArena, useArenaEvent } from "@/features/arena/ArenaProvider";
import { addTv, getAdmin, getTv, removeTv, type AdminStatus, type TvVideo } from "@/lib/api/arena";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";

const embedUrl = (v: TvVideo) =>
  v.kind === "video"
    ? `https://www.youtube-nocookie.com/embed/${v.youtubeId}?autoplay=1&rel=0&playsinline=1`
    : `https://www.youtube-nocookie.com/embed/videoseries?list=${v.youtubeId}&autoplay=1&rel=0&playsinline=1`;

export function TvPage() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { connected, ask } = useArena();
  const [shelves, setShelves] = useState<{ name: string; videos: TvVideo[] }[] | null>(null);
  const [admin, setAdmin] = useState<AdminStatus>({ enabled: false, isAdmin: false });
  const [playing, setPlaying] = useState<TvVideo | null>(null);
  const [live, setLive] = useState<{ live: boolean; by: string | null }>({ live: false, by: null });

  const load = useCallback(() => getTv().then((r) => setShelves(r.shelves), () => setShelves([])), []);
  useEffect(() => {
    void load();
    getAdmin().then(setAdmin, () => {});
  }, [load]);
  useEffect(() => {
    if (connected) void ask("tv:status").then((a) => a.ok && setLive({ live: !!a.live, by: (a.by as string) ?? null }));
  }, [connected, ask]);
  useArenaEvent<{ live: boolean; by: string | null }>("tv:live", setLive);

  const remove = async (v: TvVideo) => {
    if (!(await confirm({ title: t("Remove “{title}”?", { title: v.title }), confirmLabel: t("Remove"), danger: true }))) return;
    await removeTv(v.id).then(load, () => toast(t("That didn't work"), { tone: "error" }));
    if (playing?.id === v.id) setPlaying(null);
  };

  return (
    <div className="flex flex-col gap-6">
      {live.live && (
        <Link href="/tv/live" className="flex items-center gap-3 rounded-3xl bg-linear-to-r from-rose-600 to-red-500 p-4 text-white shadow-card transition hover:brightness-110">
          <span className="relative grid h-10 w-10 place-items-center rounded-full bg-white/20">
            <Radio className="h-5 w-5" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 animate-ping rounded-full bg-white" />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">{t("Live now")}</span>
            <span className="block text-sm text-white/90">{t("{name} is sharing a screen. Tap to watch.", { name: live.by ?? "Admin" })}</span>
          </span>
        </Link>
      )}

      <section className="overflow-hidden rounded-3xl bg-black shadow-card">
        {playing ? (
          <div>
            <div className="relative aspect-video w-full">
              <iframe
                key={playing.id}
                src={embedUrl(playing)}
                title={playing.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="flex items-center gap-3 bg-zinc-900 px-4 py-3 text-white">
              <p className="min-w-0 flex-1 truncate font-semibold">{playing.title}</p>
              <button type="button" onClick={() => setPlaying(null)} aria-label={t("Close")} className="cursor-pointer rounded-full p-1.5 hover:bg-white/10">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex aspect-[21/9] min-h-44 flex-col items-center justify-center gap-2 bg-linear-to-br from-indigo-950 via-slate-900 to-rose-950 p-6 text-center text-white">
            <Tv className="h-10 w-10 text-white/80" aria-hidden="true" />
            <p className="text-xl font-extrabold">{t("Nook TV")}</p>
            <p className="max-w-sm text-sm text-white/75">{t("Pick something from the shelves below.")}</p>
          </div>
        )}
      </section>

      {admin.isAdmin && <AdminBar shelves={shelves ?? []} onAdded={load} />}

      {shelves === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted" aria-label={t("Loading…")} />
      ) : shelves.length === 0 ? (
        <Card>
          <p className="text-sm text-muted">{admin.isAdmin ? t("Add the first video above.") : t("Nothing on Nook TV yet. The admin adds videos.")}</p>
        </Card>
      ) : (
        shelves.map((s) => (
          <section key={s.name}>
            <h2 className="mb-2 px-1 text-lg font-bold">{s.name}</h2>
            <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
              {s.videos.map((v) => (
                <li key={v.id} className="w-56 shrink-0 snap-start sm:w-64">
                  <div className={cn("group relative overflow-hidden rounded-2xl border border-border bg-surface shadow-card", playing?.id === v.id && "ring-2 ring-primary")}>
                    <button type="button" onClick={() => setPlaying(v)} className="block w-full cursor-pointer text-left">
                      <span className="relative block aspect-video bg-linear-to-br from-slate-800 to-indigo-900">
                        {v.kind === "video" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://i.ytimg.com/vi/${v.youtubeId}/mqdefault.jpg`}
                            alt=""
                            loading="lazy"
                            onError={(e) => (e.currentTarget.style.visibility = "hidden")} // no picture: the coloured card stays
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center text-sm font-bold text-white/80">{t("Playlist")}</span>
                        )}
                        <span className="absolute bottom-2 left-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white transition group-hover:bg-red-600">
                          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                        </span>
                      </span>
                      <span className="line-clamp-2 block px-3 py-2 text-sm font-semibold">{v.title}</span>
                    </button>
                    {admin.isAdmin && (
                      <button
                        type="button"
                        onClick={() => remove(v)}
                        aria-label={t("Remove")}
                        className="absolute top-2 right-2 cursor-pointer rounded-full bg-black/60 p-1.5 text-white opacity-90 hover:bg-rose-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {!admin.isAdmin && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t("Only Nook's admin chooses what's on Nook TV.")}{" "}
          {admin.enabled && (
            <Link href="/settings#admin" className="font-semibold text-primary">
              {t("Admin?")}
            </Link>
          )}
        </p>
      )}
    </div>
  );
}

function AdminBar({ shelves, onAdded }: { shelves: { name: string }[]; onAdded: () => void }) {
  const t = useT();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [shelf, setShelf] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const v = await addTv({ url, shelf: shelf.trim() || t("Picks") });
      toast(t("Added “{title}”", { title: v.title }), { tone: "success" });
      setUrl("");
      onAdded();
    } catch (err) {
      toast(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : t("That didn't work"), { tone: "error" });
    }
    setBusy(false);
  };
  return (
    <Card>
      <CardHeader
        title={t("Admin: add to Nook TV")}
        subtitle={t("Paste a YouTube video or playlist link.")}
        action={
          <Link href="/tv/live" className={buttonClasses("secondary", "sm")}>
            <Radio className="h-4 w-4" aria-hidden="true" /> {t("Share a tab")}
          </Link>
        }
      />
      <form onSubmit={submit} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          aria-label={t("YouTube link")}
          className="h-11 rounded-2xl border border-border bg-surface-strong/70 px-3 focus:border-primary focus:outline-none"
        />
        <input
          value={shelf}
          onChange={(e) => setShelf(e.target.value.slice(0, 40))}
          placeholder={t("Shelf, e.g. Cartoons")}
          aria-label={t("Shelf")}
          list="tv-shelves"
          className="h-11 rounded-2xl border border-border bg-surface-strong/70 px-3 focus:border-primary focus:outline-none"
        />
        <datalist id="tv-shelves">
          {shelves.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
        <Button type="submit" variant="primary" disabled={!url.trim() || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />} {t("Add")}
        </Button>
      </form>
    </Card>
  );
}
