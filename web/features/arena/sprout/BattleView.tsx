"use client";

// Stage 26 · Mầm Thú: a battle on screen. The rules (sprout.ts) play a whole turn at once; this screen then tells it
// step by step ("Giọt used Splash!", the health bar going down, a little shake), so you can follow what happened.

import { ArrowLeftRight, Footprints, Heart, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { Creature } from "./Creature";
import { ELEMENT_INFO, EFFECT_INFO, MOVE_NAMES } from "./names";
import * as S from "./sprout";
import { play } from "./sound";

type View = { active: [number, number]; hp: Record<number, number>; shake: number | null; flash: number | null };
const snapshot = (b: S.Battle): View => ({
  active: [b.sides[0].active, b.sides[1].active],
  hp: Object.fromEntries(b.sides.flatMap((s) => s.team.map((c) => [c.uid, c.hp]))),
  shake: null,
  flash: null,
});

function HpBar({ hp, max }: { hp: number; max: number }) {
  const k = Math.max(0, hp / max);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/15 dark:bg-white/15" role="meter" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={max}>
      <div className={cn("h-full rounded-full transition-all duration-500", k < 0.25 ? "bg-rose-500" : k < 0.5 ? "bg-amber-400" : "bg-emerald-500")} style={{ width: `${k * 100}%` }} />
    </div>
  );
}
function Card({ c, hp, foe, label }: { c: S.Fighter; hp: number; foe?: boolean; label?: string }) {
  const t = useT();
  const el = S.SPECIES[c.species].element;
  const max = S.statsOf(c).hp;
  return (
    <div className="w-40 rounded-2xl border border-border bg-surface/95 p-2 shadow-sm sm:w-56">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-bold">{label ? `${label} ${S.SPECIES[c.species].name}` : S.SPECIES[c.species].name}</p>
        <p className="shrink-0 text-xs font-semibold text-muted">{t("Lv {n}", { n: c.level })}</p>
      </div>
      <p className="mb-1 text-[11px] text-muted">
        {ELEMENT_INFO[el].emoji} {t(ELEMENT_INFO[el].name)}
        {c.sleep > 0 && <> · 💤</>}
      </p>
      <HpBar hp={hp} max={max} />
      {!foe && (
        <p className="mt-0.5 text-right font-mono text-[11px] tabular-nums">
          {Math.max(0, hp)}/{max}
        </p>
      )}
    </div>
  );
}

export function BattleView({
  battle: b,
  foeLabel,
  scene,
  onEnd,
}: {
  battle: S.Battle;
  /** "wild" or the keeper's name */
  foeLabel: string;
  scene: string;
  onEnd: (b: S.Battle) => void;
}) {
  const t = useT();
  const [view, setView] = useState<View>(() => snapshot(b));
  const [message, setMessage] = useState<string>(() => (b.wild ? t("A wild {name} appears!", { name: S.SPECIES[S.activeOf(b, 1).species].name }) : t("{keeper} wants a friendly battle!", { keeper: foeLabel })));
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const ended = useRef(false);

  const nameOf = (side: number, idx: number) => {
    const c = b.sides[side].team[idx];
    const n = S.SPECIES[c.species].name;
    return side === 0 ? n : b.wild ? t("wild {name}", { name: n }) : t("{keeper}'s {name}", { keeper: foeLabel, name: n });
  };

  /** Tell the last turn, one event at a time */
  async function tell(events: S.BattleEvent[]) {
    setBusy(true);
    const v = { ...view, active: [...view.active] as [number, number], hp: { ...view.hp } };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let last = message;
    const say = async (text: string, ms = 850) => {
      last = text;
      setMessage(text);
      setView({ ...v, hp: { ...v.hp } });
      await wait(ms);
    };
    for (const e of events) {
      if (e.t === "move") {
        const m = S.MOVES[e.move];
        await say(e.missed ? t("{name}'s {move} missed!", { name: nameOf(e.side, v.active[e.side]), move: t(MOVE_NAMES[e.move]) }) : t("{name} used {move}!", { name: nameOf(e.side, v.active[e.side]), move: t(MOVE_NAMES[e.move]) }), m.power ? 500 : 750);
      } else if (e.t === "damage") {
        const uid = b.sides[e.side].team[v.active[e.side]].uid;
        v.hp[uid] = Math.max(0, v.hp[uid] - e.amount);
        v.shake = e.side;
        play(e.mul > 1 ? "big" : e.mul < 1 ? "weak" : "hit");
        await say(e.mul > 1 ? t("It tames it: very strong!") : e.mul < 1 ? t("It barely works…") : last, e.mul !== 1 ? 900 : 450);
        v.shake = null;
      } else if (e.t === "heal") {
        const uid = b.sides[e.side].team[v.active[e.side]].uid;
        v.hp[uid] += e.amount;
        play("heal");
        await say(e.fed ? t("{name} is fed by a friend on the bench (+{n})", { name: nameOf(e.side, v.active[e.side]), n: e.amount }) : t("{name} got {n} health back", { name: nameOf(e.side, v.active[e.side]), n: e.amount }), 700);
      } else if (e.t === "status") {
        const n = nameOf(e.side, v.active[e.side]);
        const text = {
          sleep: t("{name} fell asleep!", { name: n }),
          asleep: t("{name} is fast asleep…", { name: n }),
          wake: t("{name} woke up!", { name: n }),
          guard: t("{name} is guarding.", { name: n }),
          boostAtk: t("{name} feels fired up!", { name: n }),
          lowerDef: t("{name}'s defence softened.", { name: n }),
          slow: t("{name} slowed down.", { name: n }),
        }[e.what];
        await say(text, 750);
      } else if (e.t === "faint") {
        const idx = b.sides[e.side].team.findIndex((c) => c.uid === e.uid);
        v.flash = e.side;
        play("faint");
        await say(b.wild && e.side === 1 ? t("{name} ran off home.", { name: nameOf(1, idx) }) : t("{name} is too tired to go on.", { name: nameOf(e.side, idx) }), 1000);
        v.flash = null;
      } else if (e.t === "switch") {
        v.active[e.side] = e.to;
        await say(e.side === 0 ? t("{name}, your turn!", { name: nameOf(0, e.to) }) : t("{keeper} sends out {name}!", { keeper: foeLabel, name: S.SPECIES[b.sides[1].team[e.to].species].name }), 800);
      } else if (e.t === "run") await say(t("You walked away quietly."), 700);
    }
    setView({ ...v, hp: { ...v.hp } });
    setBusy(false);
    // The computer's creature fainted: it sends out the next one
    if (!b.over && b.needSwitch[1] && !b.needSwitch[0]) {
      S.playTurn(b, { t: "move", i: 0 }, S.aiAction(b, 1));
      return tell(b.log);
    }
    if (b.needSwitch[0]) {
      setMessage(t("Who goes next?"));
      setPicking(true);
    }
    if (b.over && !ended.current) {
      ended.current = true;
      if (b.ended === "win" && !b.wild) play("win");
      if (b.ended === "lose") play("lose");
      if (b.ended === "win" && !b.wild) setMessage(t("You won the friendly battle!"));
      if (b.ended === "lose") setMessage(t("Your sproutlings are tired out…"));
      setTimeout(() => onEnd(b), b.ended === "befriend" ? 300 : 1300);
    }
  }

  const act = (a: S.BattleAction) => {
    if (busy || b.over || S.checkAction(b, 0, a)) return;
    setPicking(false);
    const foe = b.needSwitch[1] ? S.aiAction(b, 1) : b.needSwitch[0] ? ({ t: "move", i: 0 } as S.BattleAction) : S.aiAction(b, 1);
    S.playTurn(b, a, foe);
    void tell(b.log);
  };

  // Keyboard: 1-4 moves, S switch, B befriend, R run
  const actRef = useRef(act);
  actRef.current = act;
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) actRef.current({ t: "move", i: n - 1 });
      else if (e.key === "b" && b.wild) actRef.current({ t: "befriend" });
      else if (e.key === "r" && b.wild) actRef.current({ t: "run" });
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [b]);

  const mine = b.sides[0].team[view.active[0]];
  const foe = b.sides[1].team[view.active[1]];
  const me = S.activeOf(b, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
      <div className="relative overflow-hidden rounded-3xl border border-border shadow-card" style={{ background: scene }}>
        <div className="grid h-72 grid-cols-2 grid-rows-2 gap-1 p-3 sm:h-80 sm:p-4">
          <div className="self-start">
            <Card c={foe} hp={view.hp[foe.uid]} foe label={b.wild ? t("Wild") : undefined} />
          </div>
          <div className="relative grid place-items-center">
            <div className={cn("transition", view.shake === 1 && "animate-shake", view.flash === 1 && "translate-y-4 opacity-0 duration-700")}>
              <Creature species={foe.species} size={128} className="h-24 w-24 sm:h-32 sm:w-32" title={S.SPECIES[foe.species].name} />
            </div>
          </div>
          <div className="relative grid place-items-center">
            <div className={cn("transition", view.shake === 0 && "animate-shake", view.flash === 0 && "translate-y-4 opacity-0 duration-700")}>
              <Creature species={mine.species} size={140} flip className="h-28 w-28 sm:h-36 sm:w-36" title={S.SPECIES[mine.species].name} />
            </div>
          </div>
          <div className="self-end justify-self-end">
            <Card c={mine} hp={view.hp[mine.uid]} />
          </div>
        </div>
      </div>

      <p className="min-h-12 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold sm:text-base" aria-live="polite">
        {message}
      </p>

      {busy ? (
        <div className="grid h-28 place-items-center text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : b.over ? null : picking || b.needSwitch[0] ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {b.sides[0].team.map((c, i) => (
            <button
              key={c.uid}
              type="button"
              disabled={c.hp <= 0 || i === b.sides[0].active}
              onClick={() => act({ t: "switch", to: i })}
              className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border bg-surface p-2 text-left transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Creature species={c.species} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {S.SPECIES[c.species].name} <span className="text-xs font-semibold text-muted">{t("Lv {n}", { n: c.level })}</span>
                </span>
                <HpBar hp={c.hp} max={S.statsOf(c).hp} />
              </span>
            </button>
          ))}
          {!b.needSwitch[0] && (
            <Button variant="ghost" onClick={() => setPicking(false)}>
              {t("Back")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {me.moves.map((id, i) => {
              const m = S.MOVES[id];
              const el = m.element;
              const mul = el ? S.elementMul(el, S.SPECIES[S.activeOf(b, 1).species].element) : 1;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => act({ t: "move", i })}
                  className="cursor-pointer rounded-2xl border border-border bg-surface p-2.5 text-left transition hover:border-primary/50 active:scale-[0.98]"
                  style={{ borderLeft: `6px solid ${el ? ELEMENT_INFO[el].color : "#9a9aa8"}` }}
                >
                  <span className="flex items-center gap-1 text-sm font-bold">
                    <span className="hidden text-xs text-muted sm:inline">{i + 1}</span> {t(MOVE_NAMES[id])}
                    {m.power > 0 && mul > 1 && <span className="ml-auto rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{t("strong")}</span>}
                    {m.power > 0 && mul < 1 && <span className="ml-auto rounded-full bg-rose-500/15 px-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">{t("weak")}</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {el ? `${ELEMENT_INFO[el].emoji} ` : ""}
                    {m.power > 0 ? t("power {n}", { n: m.power }) : ""}
                    {m.power > 0 && m.effect ? " · " : ""}
                    {m.effect ? t(EFFECT_INFO[m.effect]) : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPicking(true)} disabled={b.sides[0].team.filter((c) => c.hp > 0).length < 2}>
              <ArrowLeftRight className="h-4 w-4" aria-hidden="true" /> {t("Switch")}
            </Button>
            {b.wild && (
              <>
                <Button size="sm" onClick={() => act({ t: "befriend" })}>
                  <Heart className="h-4 w-4" aria-hidden="true" /> {t("Befriend")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act({ t: "run" })}>
                  <Footprints className="h-4 w-4" aria-hidden="true" /> {t("Walk away")}
                </Button>
              </>
            )}
          </div>
          {b.wild && <p className="text-xs text-muted">{t("Tip: a calm (low on health) or sleepy sproutling trusts you more. Knock it out and it runs home.")}</p>}
        </div>
      )}
    </div>
  );
}
