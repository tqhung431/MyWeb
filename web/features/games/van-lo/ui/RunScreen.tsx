"use client";

// Playing inside a secret realm or a tribulation: the map, your bars, your abilities and the story so far.
//
// Controls
//   keyboard  arrows / WASD to move (Q E Z C diagonals), Space to wait, Enter to take stairs or a portal,
//             1–9 for the action bar, Esc to stop aiming
//   touch     tap next to you to step or attack, tap further away to walk there, tap yourself to wait

import { ArrowDownToLine, Hourglass, Pill, ScrollText, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { dist, isFloor, same, type Pos } from "../engine/grid";
import { findPath } from "../engine/path";
import { ABILITIES, ITEMS, MAJOR_REALMS, PATHS, realmInfo, TREASURES, type AbilityId, type ItemId, type Targeting } from "../logic/data";
import { abilityQi, realmName, stats } from "../logic/player";
import type { Game } from "../logic/types";
import { abilityTargets, act, enemyAt, finishRun, MAX_INTENT, runBagCount, visible, type Action, type Outcome, type Result } from "../logic/world";
import { Board } from "./Board";
import { ABILITY_ICON, TREASURE_ICON } from "./icons";
import { setMusic, sfx, type SfxName } from "./audio";

export { ABILITY_ICON, TREASURE_ICON };

const RUN_ITEMS: ItemId[] = [
  "hoi-xuan",
  "dai-hoi-xuan",
  "hoi-linh",
  "tu-khi",
  "boi-nguyen",
  "bao-linh-phu",
  "truyen-tong-phu",
  "truc-co-dan",
  "ket-kim-dan",
  "hoa-anh-dan",
];

type Aim = { kind: "ability" | "treasure" | "item"; id: string; targets: Pos[] };
type Slot = { key: string; label: string; icon: LucideIcon; cost?: number; cooldown: number; disabled: boolean; onUse: () => void };

const KEY_DIRS: Record<string, Pos> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  q: { x: -1, y: -1 },
  e: { x: 1, y: -1 },
  z: { x: -1, y: 1 },
  c: { x: 1, y: 1 },
};

type Props = {
  game: Game;
  update: <T>(change: (g: Game) => T, opts?: { saveNow?: boolean }) => T | undefined;
  dark: boolean;
};

// One sound per kind of thing that happened this turn
function playSounds(list: Result["fx"], outcome: Outcome) {
  const names = new Set<SfxName>();
  for (const f of list) {
    if (f.type === "slash") names.add("slash");
    else if (f.type === "hit") names.add(f.onPlayer ? "hurt" : f.crit ? "crit" : "hit");
    else if (f.type === "bolt") names.add("bolt");
    else if (f.type === "heal") names.add("heal");
    else if (f.type === "die") names.add("die");
    else if (f.type === "summon") names.add("summon");
    else if (f.type === "text" && f.tone === "loot") names.add("pickup");
  }
  if (outcome === "won") names.add("gong");
  names.forEach((n) => sfx(n));
}

export function RunScreen({ game, update, dark }: Props) {
  const r = game.run!;
  const p = game.player;
  const s = stats(p);
  const toast = useToast();
  const t = useCallback((vi: string, en: string) => (game.lang === "vi" ? vi : en), [game.lang]);
  const [fx, setFx] = useState<{ id: number; list: Result["fx"] } | null>(null);
  const [aim, setAim] = useState<Aim | null>(null);
  const [ending, setEnding] = useState<Outcome | null>(null);
  const walking = useRef<Pos[] | null>(null);
  const seen = useMemo(() => visible(game), [game]);
  useEffect(() => setMusic(r.kind === "tribulation" ? "tribulation" : "realm"), [r.kind]);
  const here = r.floor.things.find((x) => same(x.pos, r.pos) && (x.kind === "stairs" || x.kind === "portal"));

  const reasonText = (reason?: string) =>
    ({
      qi: t("Không đủ linh lực.", "Not enough qi."),
      cooldown: t("Chưa hồi chiêu.", "Still cooling down."),
      target: t("Chọn một mục tiêu hợp lệ.", "Pick a valid target."),
      blocked: t("Bị chặn.", "Blocked."),
      full: t("Tu vi đã đầy, cần độ kiếp.", "Cultivation is full: time for the tribulation."),
      "only in tribulation": t("Chỉ dùng khi độ kiếp.", "Only during the tribulation."),
      "not now": t("Không dùng được lúc này.", "Can't use that now."),
    })[reason ?? ""] ?? null;

  // One action: run the rules on a copy of the game, then animate what happened
  const perform = useCallback(
    (a: Action): (Result & { foes: number }) | undefined => {
      if (ending) return;
      const res = update((g) => {
        const out = act(g, a);
        const vis = g.run ? visible(g) : new Set<number>();
        const foes = g.run ? g.run.floor.enemies.filter((e) => vis.has(e.pos.y * g.run!.floor.w + e.pos.x)).length : 0;
        return { ...out, foes };
      });
      if (!res) return;
      if (!res.ok) {
        const text = reasonText(res.reason);
        if (text && a.type !== "move") toast(text, { tone: "error" });
        return res;
      }
      setFx({ id: performance.now(), list: res.fx });
      playSounds(res.fx, res.outcome);
      if (res.outcome !== "continue") {
        walking.current = null;
        setAim(null);
        setEnding(res.outcome);
        const outcome = res.outcome;
        setTimeout(() => update((g) => finishRun(g, outcome), { saveNow: true }), outcome === "home" ? 500 : 1600);
      }
      return res;
    },
    [ending, update, game.lang], // reasonText only depends on the language
  );

  // Walking several tiles (tap far away): one step at a time, stop when something shows up
  const walk = useCallback(
    (foesBefore: number) => {
      const next = walking.current?.shift();
      const pos = (game.run ?? r).pos;
      if (!next) return;
      const res = perform({ type: "move", dir: { x: next.x - pos.x, y: next.y - pos.y } });
      if (!res?.ok || res.outcome !== "continue" || res.foes > foesBefore || res.fx.some((f) => f.type === "hit" || f.type === "text")) {
        walking.current = null;
        return;
      }
      setTimeout(() => walkRef.current(res.foes), 120);
    },
    [game.run, perform, r],
  );
  const walkRef = useRef(walk);
  walkRef.current = walk;

  const fire = useCallback(
    (a: Aim, target: Pos) => {
      setAim(null);
      if (a.kind === "ability") perform({ type: "ability", id: a.id as AbilityId, target });
      else if (a.kind === "treasure") perform({ type: "treasure", uid: a.id, target });
      else perform({ type: "item", id: a.id as ItemId, target });
    },
    [perform],
  );

  const startAim = (kind: Aim["kind"], id: string, targeting: Targeting, range: number) => {
    walking.current = null;
    if (aim?.id === id) return setAim(null);
    if (targeting === "self") {
      if (kind === "ability") perform({ type: "ability", id: id as AbilityId });
      else if (kind === "treasure") perform({ type: "treasure", uid: id });
      else perform({ type: "item", id: id as ItemId });
      return;
    }
    const targets = abilityTargets(game, targeting, range);
    if (!targets.length) return toast(t("Không có mục tiêu trong tầm.", "Nothing in range."), { tone: "info" });
    if (targets.length === 1 && (targeting === "enemy" || targeting === "adjacent")) return fire({ kind, id, targets }, targets[0]);
    setAim({ kind, id, targets });
  };

  const onTap = (tile: Pos) => {
    walking.current = null;
    if (ending) return;
    if (aim) {
      const hit =
        aim.targets.find((x) => same(x, tile)) ?? (aim.targets.length && dist(tile, r.pos) > 0 && ["kiem-khi", "ngu-kiem"].includes(aim.id) ? tile : null);
      if (hit) fire(aim, hit);
      else setAim(null);
      return;
    }
    const d = dist(tile, r.pos);
    if (d === 0) return void perform(here ? { type: "use" } : { type: "wait" });
    if (d === 1) return void perform({ type: "move", dir: { x: tile.x - r.pos.x, y: tile.y - r.pos.y } });
    const i = tile.y * r.floor.w + tile.x;
    if (r.floor.seen[i] !== "1" || !isFloor(r.floor, tile.x, tile.y)) return;
    const path = findPath(r.floor, r.pos, tile, {
      walkable: (q) => r.floor.seen[q.y * r.floor.w + q.x] === "1",
      blocked: (q) => !!enemyAt(r, q),
    });
    if (!path?.length) return;
    walking.current = path;
    walk(r.floor.enemies.filter((e) => seen.has(e.pos.y * r.floor.w + e.pos.x)).length);
  };

  // The action bar: abilities, then treasures
  const slots: Slot[] = [
    ...p.skills.map((id) => {
      const a = ABILITIES[id];
      return {
        key: id,
        label: t(a.vi, a.en),
        icon: ABILITY_ICON[id],
        cost: abilityQi(p, id),
        cooldown: r.cooldowns[id] ?? 0,
        disabled: p.qi < abilityQi(p, id) || (r.cooldowns[id] ?? 0) > 0,
        onUse: () => startAim("ability", id, a.target, a.range),
      };
    }),
    ...p.bound.flatMap((uid) => {
      const tr = p.treasures.find((x) => x.uid === uid);
      if (!tr) return [];
      const info = TREASURES[tr.kind];
      return [
        {
          key: uid,
          label: t(info.vi, info.en),
          icon: TREASURE_ICON[tr.kind],
          cooldown: r.cooldowns[uid] ?? 0,
          disabled: (r.cooldowns[uid] ?? 0) > 0,
          onUse: () => startAim("treasure", uid, info.target, info.range),
        },
      ];
    }),
  ];

  // Keyboard
  const keys = useRef({ perform, slots, aim, here });
  keys.current = { perform, slots, aim, here };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement).closest("input, textarea, [role=dialog], [role=listbox]")) return;
      const k = keys.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      walking.current = null;
      if (KEY_DIRS[key]) {
        e.preventDefault();
        if (k.aim && ["kiem-khi", "ngu-kiem"].includes(k.aim.id)) {
          const pos = (game.run ?? r).pos;
          return fire(k.aim, { x: pos.x + KEY_DIRS[key].x, y: pos.y + KEY_DIRS[key].y });
        }
        k.perform({ type: "move", dir: KEY_DIRS[key] });
      } else if (key === " " || key === ".") {
        e.preventDefault();
        k.perform({ type: "wait" });
      } else if (key === "Enter" || key === ">") {
        if (k.here) k.perform({ type: "use" });
      } else if (key === "Escape") setAim(null);
      else if (/^[1-9]$/.test(key)) k.slots[Number(key) - 1]?.onUse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire, game.run, r]);

  const hpPct = Math.max(0, (p.hp / s.hp) * 100);
  const qiPct = Math.max(0, (p.qi / s.qi) * 100);
  const place =
    r.kind === "tribulation"
      ? r.demon
        ? t("Thiên kiếp · Tâm Ma", "Tribulation · Heart Demon")
        : t(
            `Thiên kiếp ${MAJOR_REALMS[(r.from ?? 0) + 1].vi} · ${r.survived}/${r.goal} lượt`,
            `${MAJOR_REALMS[(r.from ?? 0) + 1].en} tribulation · ${r.survived}/${r.goal} turns`,
          )
      : t(`${realmInfo(r.realm).vi} · tầng ${r.floor.depth}`, `${realmInfo(r.realm).en} · floor ${r.floor.depth}`);

  return (
    <div className="flex flex-col gap-3">
      {/* Bars */}
      <div className="grid gap-2 rounded-3xl border border-border bg-surface p-3 shadow-card backdrop-blur-xl sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span className="font-bold">
              {p.name} · {realmName(p, game.lang)}
            </span>
            <span className="text-muted">{place}</span>
          </div>
          <Bar label={t("Sinh lực", "Life")} value={p.hp} max={s.hp} pct={hpPct} color="bg-rose-600" />
          <Bar label={t("Linh lực", "Qi")} value={p.qi} max={s.qi} pct={qiPct} color="bg-sky-600" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted sm:flex-col sm:items-end">
          <span title={t(PATHS[p.path].resource.about, PATHS[p.path].resource.aboutEn)} className="flex items-center gap-1">
            {t(PATHS[p.path].resource.vi, PATHS[p.path].resource.en)}
            <span className="flex gap-0.5" aria-label={`${p.intent} / ${MAX_INTENT}`}>
              {Array.from({ length: MAX_INTENT }, (_, i) => (
                <span key={i} className={cn("h-2.5 w-1.5 rounded-full", i < p.intent ? "bg-primary" : "bg-surface-muted ring-1 ring-border")} />
              ))}
            </span>
          </span>
          <span>
            💎 {p.stones}
            {r.loot.stones ? <span className="text-emerald-600 dark:text-emerald-400"> +{r.loot.stones}</span> : null}
          </span>
          {r.status.length > 0 && (
            <span className="flex gap-1">
              {r.status.map((st) => (
                <span key={st.kind} className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">
                  {statusLabel(st.kind, game.lang)}
                  {st.kind === "shield" ? ` ${st.value}` : ""}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>

      {/* The map */}
      <div className="relative overflow-hidden rounded-3xl border border-border shadow-card">
        <Board
          run={r}
          path={p.path}
          seen={seen}
          dark={dark}
          fx={fx}
          targets={aim?.targets ?? null}
          onTap={onTap}
          className="block h-[46dvh] w-full cursor-pointer sm:h-[58vh]"
        />
        {aim && (
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-black/55 px-4 py-2 text-sm font-semibold text-white">
            {t("Chọn mục tiêu (ô xanh)", "Pick a target (green tiles)")}
            <button type="button" onClick={() => setAim(null)} className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/20 px-3 py-1">
              <X className="h-4 w-4" aria-hidden="true" /> {t("Hủy", "Cancel")}
            </button>
          </div>
        )}
        {ending && ending !== "home" && (
          <div className="absolute inset-0 flex animate-pop items-center justify-center bg-black/55 p-6 text-center text-white">
            <p className="text-2xl font-extrabold">
              {ending === "won"
                ? t("Độ kiếp thành công!", "Tribulation passed!")
                : ending === "lost"
                  ? t("Độ kiếp thất bại…", "Tribulation failed…")
                  : t("Trọng thương…", "Defeated…")}
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-stretch gap-2">
        {slots.map((slot, i) => (
          <button
            key={slot.key}
            type="button"
            onClick={slot.onUse}
            disabled={slot.disabled || !!ending}
            aria-pressed={aim?.id === slot.key}
            title={`${i + 1}. ${slot.label}`}
            className={cn(
              "relative flex min-w-16 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-2xl border border-border bg-surface-strong px-2 py-2 text-[0.7rem] leading-tight font-semibold transition sm:flex-none sm:px-3",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
              aim?.id === slot.key && "border-primary bg-primary/10",
            )}
          >
            <slot.icon className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="line-clamp-1 max-w-24">{slot.label}</span>
            <span className="text-muted">{slot.cooldown > 0 ? `⏳ ${slot.cooldown}` : slot.cost ? `${slot.cost} ${t("linh", "qi")}` : "—"}</span>
            <span className="absolute top-1 left-2 hidden text-[0.6rem] text-muted sm:block">{i + 1}</span>
          </button>
        ))}
        <BagButton game={game} t={t} onUse={(id) => startAim("item", id, id === "bao-linh-phu" ? "enemy" : "self", 6)} />
        <ActionButton icon={Hourglass} label={t("Nghỉ", "Wait")} onClick={() => perform({ type: "wait" })} disabled={!!ending} />
        {here && (
          <ActionButton
            icon={ArrowDownToLine}
            label={here.kind === "portal" ? t("Về động phủ", "Go home") : t(`Xuống tầng ${r.floor.depth + 1}`, `Down to ${r.floor.depth + 1}`)}
            onClick={() => perform({ type: "use" })}
            highlight
            disabled={!!ending}
          />
        )}
      </div>

      {/* What happened */}
      <ol className="flex flex-col gap-0.5 rounded-2xl bg-surface-muted px-4 py-3 text-sm" aria-live="polite">
        {r.log.slice(-4).map((line, i) => (
          <li
            key={`${line.turn}-${i}`}
            className={cn(
              line.tone === "bad" && "text-rose-700 dark:text-rose-300",
              line.tone === "good" && "text-emerald-700 dark:text-emerald-300",
              line.tone === "loot" && "text-amber-700 dark:text-amber-300",
              !line.tone && "text-muted",
            )}
          >
            {line.text}
          </li>
        ))}
      </ol>
      <p className="hidden text-xs text-muted sm:block">
        {t(
          "Phím: mũi tên/WASD di chuyển (Q E Z C đi chéo), Space nghỉ, Enter dùng cầu thang/trận truyền tống, 1–9 thần thông và pháp bảo, Esc hủy.",
          "Keys: arrows/WASD to move (Q E Z C diagonal), Space to wait, Enter for stairs/portal, 1–9 abilities and treasures, Esc to cancel.",
        )}
      </p>
    </div>
  );
}

function Bar({ label, value, max, pct, color }: { label: string; value: number; max: number; pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 shrink-0 font-semibold text-muted">{label}</span>
      <div
        className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums">
        {Math.max(0, Math.round(value))}/{max}
      </span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-w-16 flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-2xl border px-3 py-2 text-[0.7rem] font-semibold transition sm:flex-none",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-45",
        highlight ? "border-transparent bg-linear-to-r from-primary to-primary-2 text-on-primary" : "border-border bg-surface-strong",
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

function BagButton({ game, t, onUse }: { game: Game; t: (vi: string, en: string) => string; onUse: (id: ItemId) => void }) {
  const items = RUN_ITEMS.filter((id) => runBagCount(game, id) > 0);
  return (
    <Popover
      label={t("Túi đồ", "Bag")}
      bare
      align="end"
      width={300}
      buttonClassName="min-w-16 flex-1 flex-col gap-0.5 rounded-2xl bg-surface-strong px-3 py-2 text-[0.7rem] font-semibold text-text sm:flex-none"
      button={
        <>
          <Pill className="h-5 w-5 text-primary" aria-hidden="true" />
          {t("Túi", "Bag")}
          <span className="text-muted">{items.reduce((n, id) => n + runBagCount(game, id), 0)}</span>
        </>
      }
    >
      {(close) =>
        items.length ? (
          <ul className="flex flex-col gap-1">
            {items.map((id) => {
              const Icon = ITEMS[id].kind === "talisman" ? ScrollText : Pill;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onUse(id);
                    }}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-muted"
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">
                        {t(ITEMS[id].vi, ITEMS[id].en)} × {runBagCount(game, id)}
                      </span>
                      <span className="block text-xs text-muted">{t(ITEMS[id].about, ITEMS[id].aboutEn)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("Túi trống.", "Your bag is empty.")}</p>
        )
      }
    </Popover>
  );
}

function statusLabel(kind: string, lang: "vi" | "en") {
  const vi: Record<string, string> = { shield: "🛡 Lá chắn", reflect: "🪞 Phản", echo: "✨ Kiếm ảnh", block: "🐢 Chặn", empower: "💪 Cường", burn: "🔥 Bỏng" };
  const en: Record<string, string> = {
    shield: "🛡 Shield",
    reflect: "🪞 Reflect",
    echo: "✨ Echo",
    block: "🐢 Block",
    empower: "💪 Empowered",
    burn: "🔥 Burning",
  };
  return (lang === "vi" ? vi : en)[kind] ?? kind;
}
