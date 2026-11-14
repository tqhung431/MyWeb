"use client";

// Add songs (Stage 8): drop in files. Title, artist, genre and cover are read from each file,
// so there's nothing to fill in except what allows you to share them.

import { CheckCircle2, CircleAlert, ExternalLink, Loader2, Music, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { getUploadLimits, uploadSong, type UploadedSong } from "@/lib/api/music";
import { cn } from "@/lib/cn";
import { genreOf } from "./genres";
import { useMusic } from "./MusicProvider";
import { STARTER_PACK } from "./starter-pack";

import { useT } from "@/lib/i18n/I18nProvider";
type Rights = "own" | "cc" | "permission";
// skip: an error that trying again won't fix (too big, not audio, already in Nook)
type Item = {
  id: string;
  file: File;
  progress: number;
  status: "waiting" | "uploading" | "done" | "error";
  song?: UploadedSong;
  error?: string;
  skip?: boolean;
};

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const AUDIO = /\.(mp3|m4a|aac|ogg|opus|flac|wav)$/i;

export function AddSongForm() {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const [rights, setRights] = useState<Rights>("cc");
  const [license, setLicense] = useState("CC BY 4.0");
  const [credit, setCredit] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const { play } = useMusic();
  const busy = items.some((i) => i.status === "uploading");
  const [maxMb, setMaxMb] = useState(100);
  const [stopped, setStopped] = useState("");

  useEffect(() => {
    getUploadLimits().then(
      (l) => setMaxMb(l.maxMb),
      () => {},
    );
  }, []);

  function addFiles(files: FileList | File[]) {
    setStopped("");
    setItems((list) => {
      const kept = list.filter((i) => i.status !== "done");
      const fresh = Array.from(files)
        .filter((f) => AUDIO.test(f.name) || f.type.startsWith("audio/"))
        .filter((f) => !kept.some((i) => i.file.name === f.name && i.file.size === f.size)) // the same file twice
        .map((file): Item => {
          const id = `${file.name}-${file.size}-${Math.random()}`;
          // Too big: say so now, instead of sending it and failing at the end
          if (file.size > maxMb * 1024 * 1024)
            return {
              id,
              file,
              progress: 0,
              status: "error",
              skip: true,
              error: t("Too big: {size} (Nook takes up to {max} MB)", { size: mb(file.size), max: maxMb }),
            };
          return { id, file, progress: 0, status: "waiting" };
        });
      return [...kept, ...fresh];
    });
  }

  function update(id: string, patch: Partial<Item>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function uploadAll() {
    const fields = {
      license: rights === "own" ? "Own work" : rights === "permission" ? "Shared with permission" : license,
      credit: credit || undefined,
      sourceUrl: sourceUrl || undefined,
    };
    setStopped("");
    // One at a time: clear progress per song, and a slow network isn't flooded.
    for (const item of items.filter((i) => (i.status === "waiting" || i.status === "error") && !i.skip)) {
      update(item.id, { status: "uploading", progress: 0, error: undefined });
      let song: UploadedSong | null = null;
      let error: unknown = null;
      // A dropped connection (Wi-Fi blip, PC busy) gets two more tries
      for (let attempt = 1; attempt <= 3 && !song; attempt++) {
        try {
          song = await uploadSong(item.file, fields, (p) => update(item.id, { progress: p }));
        } catch (e) {
          error = e;
          if (!(e instanceof ApiError && e.status === 0) || attempt === 3) break;
          update(item.id, { progress: 0, error: t("Connection lost, trying again ({n} of 3)…", { n: attempt + 1 }) });
          await pause(1500 * attempt);
        }
      }
      if (song) {
        update(item.id, { status: "done", progress: 1, song, error: undefined });
        continue;
      }
      const e = error instanceof ApiError ? error : null;
      const message = e ? (e.details[0]?.message ?? e.message) : t("Upload failed");
      // 409 already in Nook, 413 too big, 415 not a song: trying again won't help
      update(item.id, { status: "error", error: message, skip: e !== null && [409, 413, 415].includes(e.status) });
      if (e?.status === 429) {
        setStopped(message); // over the hourly limit: stop here, the rest stay in the list
        break;
      }
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const waiting = items.filter((i) => (i.status === "waiting" || i.status === "error") && !i.skip).length;
  const added = items.filter((i) => i.status === "done").length;
  const problems = items.filter((i) => i.status === "error").length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card className="flex flex-col gap-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center transition",
            dragging ? "border-primary bg-primary/8" : "border-border",
          )}
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <Upload className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="font-semibold">{t("Drop song files here")}</p>
          <p className="text-sm text-muted">
            {t("MP3, M4A, OGG, FLAC or WAV, up to {n} MB each. Title, artist, genre and cover are read from each file. Any file name works.", { n: maxMb })}
          </p>
          <input
            ref={picker}
            type="file"
            accept="audio/*,.mp3,.m4a,.ogg,.opus,.flac,.wav"
            multiple
            hidden
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
          <Button variant="secondary" onClick={() => picker.current?.click()}>
            <Music className="h-4 w-4" aria-hidden="true" /> {t("Choose files")}
          </Button>
        </div>

        {/* The files */}
        {items.length > 1 && (
          <p className="text-sm font-semibold" aria-live="polite">
            {t("{n} of {total} added", { n: added, total: items.length })}
            {problems > 0 && <span className="text-rose-600 dark:text-rose-300"> · {t("{n} with a problem", { n: problems })}</span>}
          </p>
        )}
        {stopped && <p className="rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-800 dark:text-amber-200">{stopped}</p>}
        {items.length > 0 && (
          <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto" aria-live="polite">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                {i.status === "done" ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                ) : i.status === "error" ? (
                  <CircleAlert className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" aria-hidden="true" />
                ) : i.status === "uploading" ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                ) : (
                  <Music className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.song ? `${i.song.title} — ${i.song.artist}` : i.file.name}</p>
                  {i.status === "uploading" && (
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.round(i.progress * 100)}%` }} />
                    </div>
                  )}
                  {i.error && <p className={cn("text-xs", i.status === "error" ? "text-rose-600 dark:text-rose-300" : "text-muted")}>{i.error}</p>}
                  {i.song && (
                    <p className="text-xs text-muted">
                      {i.song.starterPack ? `${t("Starter pack")} · ` : ""}
                      {i.song.license}
                    </p>
                  )}
                </div>
                {i.song && (
                  <>
                    <Badge tone="primary">{t(genreOf(i.song.genre).label)}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => play(i.song!)}>
                      {t("Play")}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* What lets you share them */}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">{t("What allows you to share these songs?")}</legend>
          {(
            [
              ["own", t("I made them"), t("Your own music")],
              ["cc", t("A free licence"), t("e.g. Creative Commons; give the licence and credit")],
              ["permission", t("I have permission"), t("The artist said you may share them here")],
            ] as const
          ).map(([value, label, hint]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-3",
                rights === value ? "border-primary/50 bg-primary/8" : "border-border",
              )}
            >
              <input type="radio" name="rights" value={value} checked={rights === value} onChange={() => setRights(value)} className="mt-1" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
            </label>
          ))}
          {rights === "cc" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label={t("Licence")} value={license} onChange={(e) => setLicense(e.target.value)} hint={t("e.g. CC BY 4.0, CC BY-NC 3.0")} />
              <Input label={t("Credit (optional)")} value={credit} onChange={(e) => setCredit(e.target.value)} hint={t("feat. …, original artists")} />
              <Input
                className="sm:col-span-2"
                label={t("Where it's from (optional)")}
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          )}
          <p className="text-xs text-muted">{t("Starter-pack songs are recognised by file name; their licence and credit are filled in for you.")}</p>
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
          <span>{t("I may share these songs with everyone on Nook, as chosen above.")}</span>
        </label>

        <Button variant="primary" size="lg" onClick={uploadAll} disabled={!confirmed || waiting === 0 || busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
          {busy ? t("Uploading…") : waiting === 1 ? t("Add 1 song") : waiting > 1 ? t("Add {n} songs", { n: waiting }) : t("Add songs")}
        </Button>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">{t("Starter pack: 12 free songs with vocals")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t(
            "Picked by listener ratings on ccMixter, 3 per genre, all under Creative Commons licences that allow sharing them here. Open each page, press Download, then drop the files on the left.",
          )}
        </p>
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {STARTER_PACK.map((s) => (
            <li key={s.page} className="flex items-center gap-3 py-2">
              <Badge>{t(genreOf(s.genre).label)}</Badge>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.title}</span>
                <span className="block truncate text-xs text-muted">
                  {s.artist} · {s.license}
                </span>
              </span>
              <a
                href={s.page}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("ghost", "sm")}
                aria-label={t("Open {title} on ccMixter", { title: s.title })}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {t("Running Nook yourself? Many songs at once can be added from a folder on the Nook PC: see docs/stage-8.md.")}
        </p>
        <Link href="/music" className={buttonClasses("ghost", "sm", "mt-3 -ml-3")}>
          ← Back to the charts
        </Link>
      </Card>
    </div>
  );
}
