"use client";

// Stage 26 · Mầm Thú's front page: carry on, or start a new adventure by choosing your first sproutling; the
// Sproutling book (who you've met and befriended) and the gardeners who've awakened the most shrines.

import { Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { useMe } from "@/features/me/MeProvider";
import { deleteSave, getLeaderboard, type BoardRow } from "@/lib/api/games";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { Creature } from "./Creature";
import { AREAS, STARTERS } from "./island";
import { ELEMENT_INFO, SPECIES_INFO, SPECIES_NAMES } from "./names";
import { clearLocal, loadBest, newSave, saveGame, type SproutSave } from "./save";
import { SproutGame } from "./SproutGame";
import { SPECIES, SPECIES_IDS, statsOf } from "./sprout";

export function SproutHome() {
  const t = useT();
  const { user } = useMe();
  const confirm = useConfirm();
  const [save, setSave] = useState<SproutSave | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [board, setBoard] = useState<BoardRow[]>([]);

  useEffect(() => {
    void loadBest(!!user).then((s) => {
      setSave(s);
      setLoaded(true);
    });
  }, [user, playing]);
  useEffect(() => {
    getLeaderboard("sprout").then(setBoard, () => setBoard([]));
  }, [playing]);

  if (playing && save) return <SproutGame initial={save} signedIn={!!user} onQuit={() => setPlaying(false)} />;

  const start = (starter: (typeof STARTERS)[number]) => {
    const s = newSave(user?.name ?? t("Gardener"), starter);
    saveGame(s, !!user, true);
    setSave(s);
    setChoosing(false);
    setPlaying(true);
  };
  const fresh = async () => {
    if (save && !(await confirm({ title: t("Start a new adventure?"), description: t("Your current game and its sproutlings will be gone."), confirmLabel: t("Start again"), danger: true }))) return;
    clearLocal();
    if (user) await deleteSave("sprout").catch(() => {});
    setSave(null);
    setChoosing(true);
  };

  const seen = new Set(save?.seen ?? []);
  const friends = new Set(save?.friends ?? []);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-emerald-600 via-teal-600 to-sky-700 p-6 text-white shadow-card sm:p-8">
          <div className="pointer-events-none absolute -right-4 -bottom-4 flex items-end" aria-hidden="true">
            <Creature species="mamTre" size={92} />
            <Creature species="giot" size={74} />
            <Creature species="thanHong" size={84} />
          </div>
          <p className="text-sm font-semibold tracking-wide text-emerald-100 uppercase">{t("Creature adventure · with saves")}</p>
          <h2 className="mt-1 text-3xl font-extrabold">{t("Sproutlings")}</h2>
          <p className="mt-1 max-w-[60%] text-white/90 sm:max-w-sm">
            {t("A storm scattered the seed-spirits of Clearwater Isle. Befriend them, grow together, and wake the six shrines.")}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {save && (
              <Button variant="light" onClick={() => setPlaying(true)}>
                {t("Continue: {area}", { area: t(AREAS[save.area].en) })}
              </Button>
            )}
            {loaded && (
              <Button variant={save ? "secondary" : "light"} onClick={save ? fresh : () => setChoosing(true)}>
                {save ? t("New adventure") : t("Start your adventure")}
              </Button>
            )}
          </div>
          {!user && <p className="mt-3 max-w-[60%] text-xs text-white/80 sm:max-w-sm">{t("Without a name the game is saved only in this browser.")}</p>}
        </section>

        {choosing && (
          <Card>
            <CardHeader title={t("Choose your first sproutling")} subtitle={t("It will walk the island with you. You'll meet the others along the way.")} />
            <div role="radiogroup" aria-label={t("First sproutling")} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STARTERS.map((s) => {
                const el = ELEMENT_INFO[SPECIES[s].element];
                return (
                  <button key={s} type="button" role="radio" aria-checked={false} onClick={() => start(s)} className="cursor-pointer rounded-2xl border border-border bg-surface p-3 text-center transition hover:-translate-y-0.5 hover:border-primary/50">
                    <Creature species={s} size={110} className="mx-auto" />
                    <p className="mt-1 text-lg font-extrabold">{t(SPECIES_NAMES[s])}</p>
                    <p className={cn("mx-auto mt-0.5 w-fit rounded-full px-2 text-xs font-bold", el.chip)}>
                      {el.emoji} {t(el.name)}
                    </p>
                    <p className="mt-2 text-xs text-muted">{t(SPECIES_INFO[s])}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <CardHeader title={t("The Five Elements")} subtitle={t("Each element feeds the next and tames the one two steps on.")} />
          <p className="flex flex-wrap items-center gap-1 text-sm font-semibold">
            {(["water", "wood", "fire", "earth", "metal"] as const).map((e, i) => (
              <span key={e} className="flex items-center gap-1">
                <span className={cn("rounded-full px-2 py-0.5", ELEMENT_INFO[e].chip)}>
                  {ELEMENT_INFO[e].emoji} {t(ELEMENT_INFO[e].name)}
                </span>
                {i < 4 && <span className="text-muted">→</span>}
              </span>
            ))}
            <span className="text-muted">→ …</span>
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-muted">
            <li>{t("Tames: Water tames Fire, Fire tames Metal, Metal tames Wood, Wood tames Earth, Earth tames Water. A move that tames hits 1.5× as hard.")}</li>
            <li>{t("Feeds: a friend on the bench whose element feeds the one fighting gives it a little health every turn.")}</li>
            <li>{t("Befriend, don't knock out: a calm or sleepy wild sproutling trusts you more. Then a short game wins it over.")}</li>
          </ul>
        </Card>

        <Card>
          <CardHeader title={t("Sproutling book")} subtitle={t("{n} of {total} befriended", { n: friends.size, total: SPECIES_IDS.length })} />
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {SPECIES_IDS.map((s) => {
              const known = seen.has(s) || friends.has(s);
              return (
                <li key={s} className={cn("rounded-2xl border border-border p-1.5 text-center", friends.has(s) ? "bg-surface" : "bg-surface-muted")} title={known ? t(SPECIES_INFO[s]) : undefined}>
                  <div className={cn(!known && "opacity-25 brightness-0 dark:invert")}>
                    <Creature species={s} size={64} className="mx-auto" />
                  </div>
                  <p className="truncate text-[11px] font-semibold">{known ? t(SPECIES_NAMES[s]) : "?"}</p>
                  {friends.has(s) && <p className="text-[10px] text-emerald-600 dark:text-emerald-400">{t("Friend")}</p>}
                </li>
              );
            })}
          </ul>
          {save && <p className="mt-3 text-xs text-muted">{t("Your team: {list}", { list: save.team.map((c) => `${t(SPECIES_NAMES[c.species])} (${c.level}, ${c.hp}/${statsOf(c).hp})`).join(", ") })}</p>}
        </Card>
      </div>

      <Card className="self-start">
        <CardHeader title={t("Best gardeners")} subtitle={t("Shrines awakened, then friends made")} />
        {board.length === 0 ? (
          <p className="text-sm text-muted">{t("Nobody has awakened a shrine yet.")}</p>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {board.map((r) => (
              <li key={r.rank} className={cn("flex items-center gap-3 rounded-xl px-2 py-1.5", r.me && "bg-primary/10")}>
                <span className="w-6 text-center text-sm font-bold text-muted">{r.rank === 1 ? <Trophy className="mx-auto h-4 w-4 text-amber-500" aria-label="1" /> : r.rank}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="text-xs text-muted">🌱 {r.kills}</span>
                <span className="w-10 text-right font-mono text-sm font-bold">🏮{r.level}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
