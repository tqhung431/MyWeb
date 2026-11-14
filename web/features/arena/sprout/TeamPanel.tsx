"use client";

// Stage 26 · Mầm Thú: your sproutlings. The first three fight, in this order. At a shrine or at home you can also
// swap friends with the ones waiting at home, and at a shrine a sproutling that's old enough can grow.

import { ArrowDown, ArrowUp, Home, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { Creature } from "./Creature";
import { ELEMENT_INFO, MOVE_NAMES, SPECIES_INFO } from "./names";
import { TEAM_MAX, type SproutSave } from "./save";
import * as S from "./sprout";

function Row({ c, i, children, fighting }: { c: S.Creature; i: number; children?: React.ReactNode; fighting: boolean }) {
  const t = useT();
  const sp = S.SPECIES[c.species];
  const st = S.statsOf(c);
  const el = ELEMENT_INFO[sp.element];
  return (
    <li className={cn("flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2.5 sm:flex-row sm:items-center", fighting && "ring-1 ring-primary/40")}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Creature species={c.species} size={60} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold">
            {sp.name}
            <span className="text-xs font-semibold text-muted">{t("Lv {n}", { n: c.level })}</span>
            <span className={cn("rounded-full px-1.5 text-[10px] font-bold", el.chip)}>
              {el.emoji} {t(el.name)}
            </span>
            {fighting && <span className="text-[10px] font-bold text-primary">{t("Fights #{n}", { n: i + 1 })}</span>}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className={cn("h-full", c.hp / st.hp < 0.3 ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${(100 * c.hp) / st.hp}%` }} />
            </div>
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {c.hp}/{st.hp}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" title={t("Experience")}>
            <div className="h-full bg-sky-500" style={{ width: `${(100 * c.xp) / S.xpToNext(c.level)}%` }} />
          </div>
          <p className="mt-1 truncate text-[11px] text-muted">{c.moves.map((m) => t(MOVE_NAMES[m])).join(" · ")}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap justify-end gap-1">{children}</div>}
    </li>
  );
}

export function TeamPanel({ save, place, onChange, onClose, onGrow }: { save: SproutSave; place: "shrine" | "home" | null; onChange: () => void; onClose: () => void; onGrow: (c: S.Creature) => void }) {
  const t = useT();
  const team = save.team;
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= team.length) return;
    [team[i], team[j]] = [team[j], team[i]];
    onChange();
  };
  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-background p-3 shadow-card sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex-1 text-lg font-extrabold">{place === "shrine" ? t("The shrine") : place === "home" ? t("Home") : t("Your sproutlings")}</h3>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("Close")}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {place === "shrine" && <p className="mb-3 text-sm text-muted">{t("Everyone is rested and full of health. Sproutlings that are old enough can grow here.")}</p>}
      <p className="mb-2 text-xs text-muted">{t("The first three fight, in this order. Friends on the bench help a fighter whose element they feed.")}</p>
      <ul className="flex flex-col gap-2">
        {team.map((c, i) => (
          <Row key={c.uid} c={c} i={i} fighting={i < 3}>
            <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Move up")}>
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === team.length - 1} aria-label={t("Move down")}>
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            {place === "shrine" && S.canGrow(c) && (
              <Button size="sm" onClick={() => onGrow(c)}>
                <Sparkles className="h-4 w-4" aria-hidden="true" /> {t("Grow")}
              </Button>
            )}
            {place && team.length > 1 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  save.home.push(...team.splice(i, 1));
                  onChange();
                }}
              >
                <Home className="h-4 w-4" aria-hidden="true" /> {t("Rest at home")}
              </Button>
            )}
          </Row>
        ))}
      </ul>
      {place === "shrine" && team.some((c) => S.SPECIES[c.species].grows && !S.canGrow(c)) && (
        <p className="mt-2 text-xs text-muted">
          {team
            .filter((c) => S.SPECIES[c.species].grows && !S.canGrow(c))
            .map((c) => t("{name} can grow at level {n}", { name: S.SPECIES[c.species].name, n: S.SPECIES[c.species].grows!.level }))
            .join(" · ")}
        </p>
      )}
      {place && save.home.length > 0 && (
        <>
          <h4 className="mt-4 mb-2 text-sm font-bold">{t("Waiting at home")}</h4>
          <ul className="flex flex-col gap-2">
            {save.home.map((c, i) => (
              <Row key={c.uid} c={c} i={i} fighting={false}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={team.length >= TEAM_MAX}
                  onClick={() => {
                    const [x] = save.home.splice(i, 1);
                    x.hp = S.statsOf(x).hp; // rested at home
                    team.push(x);
                    onChange();
                  }}
                >
                  {t("Bring along")}
                </Button>
              </Row>
            ))}
          </ul>
        </>
      )}
      {!place && <p className="mt-3 text-xs text-muted">{t("Visit a shrine or your house to swap friends with the ones at home.")}</p>}
      {team[0] && <p className="mt-3 text-xs text-muted italic">{t(SPECIES_INFO[team[0].species])}</p>}
    </div>
  );
}
