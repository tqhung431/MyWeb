"use client";

// The cave abode (động phủ): your home between runs. Cultivate, practise methods, choose abilities,
// refine treasures, change gear, shop, and set off for a secret realm, or face the tribulation.

import { Backpack, BookOpen, Flame, Gem, Lock, Mountain, Shirt, Sparkles, Store, Sword, Trophy, X, Zap } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  ABILITIES,
  ELEMENTS,
  ITEMS,
  MAJOR_REALMS,
  QUALITIES,
  ROOTS,
  PATHS,
  REALM_IDS,
  realmInfo,
  techniquesOf,
  abilitiesOf,
  SLOTS,
  TECHNIQUES,
  TREASURE_GRADES,
  TREASURES,
  type AbilityId,
  type ItemId,
  type Slot,
  type Stats,
  type TechniqueId,
} from "../logic/data";
import {
  bagSize,
  buy,
  canPractise,
  canRefine,
  equip,
  gearPrice,
  gearStats,
  meditate,
  meditateCost,
  atPeak,
  abilityQi,
  isSlip,
  meditateGain,
  needed,
  practise,
  readyForTribulation,
  realmName,
  refine,
  rootSpeed,
  sellGear,
  setMain,
  shopFor,
  skillSlots,
  stats,
  toggleBound,
  toggleSkill,
  treasureSlots,
  unlockedAbilities,
  usePillAtHome,
} from "../logic/player";
import type { Game } from "../logic/types";
import type { RealmId } from "../logic/data";
import { startRun, startTribulation, tribulationTurns } from "../logic/world";
import { setMusic, sfx } from "./audio";
import { Furnace } from "./Furnace";
import { Leaderboard } from "./Leaderboard";
import { ABILITY_ICON, TREASURE_ICON } from "./icons";

type Tab = "cultivate" | "methods" | "abilities" | "treasures" | "gear" | "furnace" | "bag" | "realms" | "ranking";
type Props = { game: Game; update: <T>(change: (g: Game) => T, opts?: { saveNow?: boolean }) => T | undefined };

const STAT_NAMES: Record<keyof Stats, [string, string]> = {
  hp: ["Sinh lực", "Life"],
  qi: ["Linh lực", "Qi"],
  atk: ["Công", "Attack"],
  def: ["Thủ", "Defence"],
  crit: ["Bạo kích %", "Crit %"],
  qiRegen: ["Hồi linh", "Qi regen"],
};

export function Home({ game, update }: Props) {
  const [tab, setTab] = useState<Tab>("cultivate");
  const t = (vi: string, en: string) => (game.lang === "vi" ? vi : en);
  const p = game.player;
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => setMusic("home"), []);
  // A gong when you come home from a breakthrough
  useEffect(() => {
    if (game.notice && /Độ kiếp thành công|Tribulation passed/.test(game.notice)) sfx("gong");
  }, [game.notice]);

  const tabs: { id: Tab; label: string; icon: typeof Sword }[] = [
    { id: "cultivate", label: t("Tu luyện", "Cultivate"), icon: Sparkles },
    { id: "methods", label: t("Công pháp", "Methods"), icon: BookOpen },
    { id: "abilities", label: t("Thần thông", "Abilities"), icon: Zap },
    { id: "treasures", label: t("Pháp bảo", "Treasures"), icon: Gem },
    { id: "gear", label: t("Trang bị", "Gear"), icon: Shirt },
    { id: "furnace", label: t("Lò luyện", "Furnace"), icon: Flame },
    { id: "bag", label: t("Túi & chợ", "Bag & shop"), icon: Store },
    { id: "realms", label: t("Bí cảnh", "Realms"), icon: Mountain },
    { id: "ranking", label: t("Xếp hạng", "Ranking"), icon: Trophy },
  ];

  const enter = (realm: RealmId = "vu-an-coc") => {
    update((g) => startRun(g, realm), { saveNow: true });
  };
  // From Trúc Cơ on there's more than one realm: the big button opens the list
  const enterMain = () => (p.major >= 1 ? setTab("realms") : enter());

  return (
    <div className="flex flex-col gap-4">
      {game.notice && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium">
          <span className="flex-1">{game.notice}</span>
          <button
            type="button"
            aria-label={t("Đóng", "Close")}
            onClick={() => update((g) => void delete g.notice)}
            className="cursor-pointer text-muted hover:text-text"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <Summary game={game} onEnter={enterMain} t={t} />

      <nav aria-label={t("Động phủ", "Cave abode")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            aria-pressed={tab === x.id}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition",
              tab === x.id ? "bg-primary text-on-primary" : "bg-surface-muted text-muted hover:text-text",
            )}
          >
            <x.icon className="h-4 w-4" aria-hidden="true" /> {x.label}
          </button>
        ))}
      </nav>

      {tab === "cultivate" && (
        <Cultivate
          game={game}
          t={t}
          onMeditate={(n) => {
            const res = update((g) => meditate(g, n));
            if (res?.ok) sfx(res.layers ? "gong" : "heal");
            if (!res?.ok) toast(t("Cần linh thạch để tu luyện.", "You need spirit stones to cultivate."), { tone: "error" });
            else
              toast(
                t(
                  `+${res.gained} tu vi${res.layers ? `, lên ${res.layers} tầng!` : ""}`,
                  `+${res.gained} cultivation${res.layers ? `, up ${res.layers} layer(s)!` : ""}`,
                ),
                { tone: "success" },
              );
          }}
          onTribulation={async () => {
            const ok = await confirm({
              title: t(`Độ kiếp ${MAJOR_REALMS[p.major + 1].vi}?`, `Face the ${MAJOR_REALMS[p.major + 1].en} tribulation?`),
              description: t(
                `Thiên lôi sẽ đánh xuống ${tribulationTurns(p.major)} lượt: tránh những ô được đánh dấu vàng. Sau đó Tâm Ma xuất hiện; đánh bại nó để lên ${MAJOR_REALMS[p.major + 1].vi}. Thất bại sẽ mất 1/4 tu vi.`,
                `Lightning falls for ${tribulationTurns(p.major)} turns: avoid the tiles marked in gold. Then your Heart Demon appears; defeat it to reach ${MAJOR_REALMS[p.major + 1].en}. Failing costs a quarter of your cultivation.`,
              ),
              confirmLabel: t("Độ kiếp", "Begin"),
            });
            if (ok) update((g) => startTribulation(g), { saveNow: true });
          }}
        />
      )}
      {tab === "methods" && <Methods game={game} t={t} update={update} toast={toast} />}
      {tab === "abilities" && <Abilities game={game} t={t} update={update} toast={toast} />}
      {tab === "treasures" && <Treasures game={game} t={t} update={update} toast={toast} />}
      {tab === "gear" && <GearTab game={game} t={t} update={update} />}
      {tab === "furnace" && <Furnace game={game} t={t} update={update} toast={toast} />}
      {tab === "bag" && <BagTab game={game} t={t} update={update} toast={toast} />}
      {tab === "realms" && <Realms game={game} t={t} onEnter={enter} />}
      {tab === "ranking" && <Leaderboard lang={game.lang} />}
    </div>
  );
}

type T = (vi: string, en: string) => string;
type Toast = ReturnType<typeof useToast>;
type Update = Props["update"];

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl", className)}>
      <h2 className="text-lg font-bold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Summary({ game, onEnter, t }: { game: Game; onEnter: () => void; t: T }) {
  const p = game.player;
  const s = stats(p);
  const need = needed(p);
  const pct = Math.min(100, (p.cultivation / need) * 100);
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-surface-strong p-5 shadow-card sm:p-6">
      <InkHills />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">{t("Động phủ của", "The cave abode of")}</p>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{p.name}</h2>
          <p className="mt-1 font-semibold text-primary">
            {t(PATHS[p.path].vi, PATHS[p.path].en)} · {realmName(p, game.lang)}
          </p>
          <div className="mt-2 w-64 max-w-full">
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-linear-to-r from-primary to-primary-2" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">
              {t("Tu vi", "Cultivation")} {Math.floor(p.cultivation)}/{need}
              {readyForTribulation(p) && <strong className="text-primary"> · {t("sẵn sàng độ kiếp!", "ready for the tribulation!")}</strong>}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <p className="text-sm text-muted">
            ❤️ {p.hp}/{s.hp} · 💧 {p.qi}/{s.qi} · 💎 {p.stones}
          </p>
          <Button variant="primary" size="lg" onClick={onEnter}>
            <Mountain className="h-5 w-5" aria-hidden="true" /> {t("Vào bí cảnh", "Enter the realm")}
          </Button>
        </div>
      </div>
    </section>
  );
}

// A few ink mountains behind the summary card
function InkHills() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 120"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full text-text opacity-[0.07]"
    >
      <path d="M0 120 L0 80 Q40 40 70 70 Q100 30 140 60 Q170 20 210 64 Q250 36 280 70 Q320 44 350 74 Q380 60 400 80 L400 120 Z" fill="currentColor" />
      <path d="M0 120 L0 98 Q60 70 110 96 Q160 74 220 100 Q280 80 330 102 Q370 90 400 104 L400 120 Z" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

function StatGrid({ stats: s, t }: { stats: Partial<Stats>; t: T }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      {(Object.keys(STAT_NAMES) as (keyof Stats)[])
        .filter((k) => s[k] !== undefined && s[k] !== 0)
        .map((k) => (
          <div key={k} className="rounded-xl bg-surface-muted px-3 py-2">
            <dt className="text-xs text-muted">{t(...STAT_NAMES[k])}</dt>
            <dd className="font-bold tabular-nums">{Math.round((s[k] ?? 0) * 10) / 10}</dd>
          </div>
        ))}
    </dl>
  );
}

function Cultivate({ game, t, onMeditate, onTribulation }: { game: Game; t: T; onMeditate: (n: number) => void; onTribulation: () => void }) {
  const p = game.player;
  const root = ROOTS.find((r) => r.count === p.root.length)!;
  const ready = readyForTribulation(p);
  const max = Math.floor(p.stones / meditateCost(p));
  const pill = MAJOR_REALMS[p.major].pill;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title={t("Tọa thiền", "Meditate")}
        subtitle={t(
          `Mỗi lần tốn ${meditateCost(p)} linh thạch, được ${meditateGain(p)} tu vi. Đầy một tầng thì tự lên tầng.`,
          `Each sitting costs ${meditateCost(p)} spirit stones for ${meditateGain(p)} cultivation. A full layer moves you up.`,
        )}
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onMeditate(1)} disabled={ready || max < 1}>
            {t("Tọa thiền", "Meditate")} ×1
          </Button>
          <Button onClick={() => onMeditate(5)} disabled={ready || max < 2}>
            ×5
          </Button>
          <Button onClick={() => onMeditate(max)} disabled={ready || max < 2}>
            {t("Bế quan", "Seclusion")} (×{max})
          </Button>
        </div>
        {atPeak(p) && (
          <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm">
            {t(
              "Đỉnh phong Nguyên Anh! Con đường Hóa Thần sẽ mở ở chương sau.",
              "The peak of Nascent Soul! The road to Spirit Severing opens in a later chapter.",
            )}
          </p>
        )}
        {ready && (
          <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="font-semibold">{t(`Bình cảnh ${MAJOR_REALMS[p.major].vi} tầng 9!`, `${MAJOR_REALMS[p.major].en} 9: the bottleneck!`)}</p>
            <p className="mt-1 text-sm text-muted">
              {t(`Chỉ có vượt thiên kiếp mới lên ${MAJOR_REALMS[p.major + 1].vi} được.`, `Only a tribulation can take you to ${MAJOR_REALMS[p.major + 1].en}.`)}
              {pill && (p.bag[pill] ?? 0) > 0 && ` ${t(`Bạn có ${ITEMS[pill].vi}.`, `You have a ${ITEMS[pill].en}.`)}`}
            </p>
            <Button variant="primary" className="mt-3" onClick={onTribulation}>
              ⚡ {t("Độ kiếp", "Face the tribulation")}
            </Button>
          </div>
        )}
      </Panel>
      <Panel title={t("Căn cơ", "Foundations")}>
        <p className="text-sm">
          <strong>{t("Linh căn", "Spiritual root")}:</strong> {t(root.vi, root.en)} (
          {p.root.map((e) => (
            <span key={e} style={{ color: ELEMENTS[e].color }} className="font-semibold">
              {t(ELEMENTS[e].vi, ELEMENTS[e].en)}{" "}
            </span>
          ))}
          ) · {t("tốc độ tu luyện", "cultivation speed")} ×{rootSpeed(p.root)}
        </p>
        <div className="mt-3">
          <StatGrid stats={stats(p)} t={t} />
        </div>
        <p className="mt-3 text-xs text-muted">
          {t("Chuyến đi", "Runs")} {p.record.runs} · {t("hạ yêu thú", "defeated")} {p.record.kills} · {t("tầng sâu nhất", "deepest floor")} {p.record.deepest} ·{" "}
          {t("trọng thương", "defeats")} {p.record.deaths}
        </p>
      </Panel>
    </div>
  );
}

function Methods({ game, t, update, toast }: { game: Game; t: T; update: Update; toast: Toast }) {
  const p = game.player;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {techniquesOf(p.path).map((id) => {
        const info = TECHNIQUES[id];
        const known = p.techniques.find((x) => x.id === id);
        const role = p.main === id ? t("Chủ tu", "Main") : p.side.includes(id) ? t("Phụ tu (30%)", "Side (30%)") : null;
        const check = canPractise(p, id);
        const match = p.root.includes(info.element);
        return (
          <section key={id} className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5 shadow-card", !known && "opacity-70")}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">{info.grade}</Badge>
                <span className="text-xs font-semibold" style={{ color: ELEMENTS[info.element].color }}>
                  {t(ELEMENTS[info.element].vi, ELEMENTS[info.element].en)}
                  {match && known ? ` · ${t("hợp linh căn ×1.25", "matches your root ×1.25")}` : ""}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-bold">{t(info.vi, info.en)}</h3>
              <p className="text-sm text-muted">{t(info.about, info.aboutEn)}</p>
            </div>
            {known ? (
              <>
                <p className="text-sm">
                  {t("Tầng", "Level")} <strong>{known.level}</strong>/{info.maxLevel} {role && <Badge>{role}</Badge>}
                </p>
                <p className="text-xs text-muted">
                  {t("Mỗi tầng", "Per level")}:{" "}
                  {Object.entries(info.perLevel)
                    .map(([k, v]) => `+${v} ${t(...STAT_NAMES[k as keyof Stats])}`)
                    .join(", ")}
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!check.ok}
                    onClick={() => {
                      const learned = update((g) => practise(g, id)) ?? [];
                      toast(
                        learned.length
                          ? t(
                              `Lĩnh ngộ thần thông: ${learned.map((a) => ABILITIES[a].vi).join(", ")}!`,
                              `New ability: ${learned.map((a) => ABILITIES[a].en).join(", ")}!`,
                            )
                          : t("Tu luyện thành công.", "Practised."),
                        { tone: "success" },
                      );
                    }}
                  >
                    {check.reason === "max" ? t("Viên mãn", "Mastered") : `${t("Tu luyện", "Practise")} · 💎${check.cost}`}
                  </Button>
                  {p.main !== id && (
                    <Button size="sm" onClick={() => update((g) => setMain(g, id))}>
                      {t("Làm chủ tu", "Make main")}
                    </Button>
                  )}
                </div>
                {check.reason === "realm" && (
                  <p className="text-xs text-muted">
                    {t(`Cần Luyện Khí tầng ${Math.max(1, (known.level + 1) * 2 - 1)}.`, `Needs Qi Refining ${Math.max(1, (known.level + 1) * 2 - 1)}.`)}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-auto text-sm text-muted">
                {t(
                  "Chưa học. Tìm ngọc giản trong bí cảnh (rương ở tầng sâu, hoặc Mãng Vương).",
                  "Not learned. Find its jade slip in a secret realm (deep chests, or the Python King).",
                )}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Abilities({ game, t, update, toast }: { game: Game; t: T; update: Update; toast: Toast }) {
  const p = game.player;
  const unlocked = unlockedAbilities(p);
  return (
    <Panel
      title={t(`Thần thông mang theo: ${p.skills.length}/${skillSlots(p)}`, `Abilities you carry: ${p.skills.length}/${skillSlots(p)}`)}
      subtitle={t(
        "Thần thông lĩnh ngộ từ các tầng công pháp. Mỗi đại cảnh giới có thêm ô.",
        "Abilities come from method levels. Each major realm gives another slot.",
      )}
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {abilitiesOf(p.path).map((id) => {
          const a = ABILITIES[id];
          const Icon = ABILITY_ICON[id];
          const on = p.skills.includes(id);
          const open = unlocked.includes(id);
          return (
            <li
              key={id}
              className={cn("flex items-start gap-3 rounded-2xl border p-3", on ? "border-primary bg-primary/8" : "border-border", !open && "opacity-60")}
            >
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t(a.vi, a.en)}</p>
                <p className="text-xs text-muted">{t(a.about, a.aboutEn)}</p>
                <p className="mt-1 text-xs text-muted">
                  {abilityQi(p, id)} {t("linh lực", "qi")} ·{" "}
                  {a.cooldown ? t(`hồi ${a.cooldown} lượt`, `${a.cooldown}-turn cooldown`) : t("không hồi chiêu", "no cooldown")}
                  {!open && ` · ${t(`cần ${TECHNIQUES[a.from[0]].vi} tầng ${a.from[1]}`, `needs ${TECHNIQUES[a.from[0]].en} level ${a.from[1]}`)}`}
                </p>
              </div>
              {open && (
                <Button
                  size="sm"
                  variant={on ? "secondary" : "primary"}
                  onClick={() => {
                    if (!update((g) => toggleSkill(g.player, id))) toast(t("Hết ô thần thông.", "No free ability slot."), { tone: "error" });
                  }}
                >
                  {on ? t("Gỡ", "Remove") : t("Mang", "Equip")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function Treasures({ game, t, update, toast }: { game: Game; t: T; update: Update; toast: Toast }) {
  const p = game.player;
  return (
    <Panel
      title={t(`Pháp bảo nhận chủ: ${p.bound.length}/${treasureSlots(p)}`, `Bound treasures: ${p.bound.length}/${treasureSlots(p)}`)}
      subtitle={t(
        `Tế luyện bằng linh thạch và Yêu Đan (có ${p.bag["yeu-dan"] ?? 0}). Tầng 10 thì thăng phẩm.`,
        `Refine with spirit stones and beast cores (you have ${p.bag["yeu-dan"] ?? 0}). At level 10 it moves up a grade.`,
      )}
    >
      <ul className="grid gap-3 md:grid-cols-2">
        {p.treasures.map((tr) => {
          const info = TREASURES[tr.kind];
          const Icon = TREASURE_ICON[tr.kind];
          const bound = p.bound.includes(tr.uid);
          const c = canRefine(p, tr);
          return (
            <li key={tr.uid} className={cn("flex flex-col gap-2 rounded-2xl border p-4", bound ? "border-primary bg-primary/8" : "border-border")}>
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex-1">
                  <p className="font-semibold">{t(info.vi, info.en)}</p>
                  <p className="text-xs text-muted">
                    {t(TREASURE_GRADES[tr.grade].vi, TREASURE_GRADES[tr.grade].en)} · {t("tầng", "level")} {tr.level}/10
                  </p>
                  <p className="mt-1 text-xs text-muted">{t(info.about, info.aboutEn)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={bound ? "secondary" : "primary"}
                  onClick={() => {
                    if (!update((g) => toggleBound(g, tr.uid))) toast(t("Hết ô pháp bảo.", "No free treasure slot."), { tone: "error" });
                  }}
                >
                  {bound ? t("Thu hồi", "Unbind") : t("Nhận chủ", "Bind")}
                </Button>
                <Button size="sm" disabled={!c.ok} onClick={() => update((g) => refine(g, tr.uid))}>
                  {c.upgrade ? t("Thăng phẩm", "Upgrade") : t("Tế luyện", "Refine")} · 💎{c.stones} · {t("Yêu Đan", "cores")} {c.cores}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function GearTab({ game, t, update }: { game: Game; t: T; update: Update }) {
  const p = game.player;
  const confirm = useConfirm();
  const equipped = new Set(Object.values(p.equipped));
  return (
    <div className="flex flex-col gap-4">
      <Panel title={t("Đang mặc", "Wearing")}>
        <ul className="grid gap-2 sm:grid-cols-5">
          {(Object.keys(SLOTS) as Slot[]).map((slot) => {
            const item = p.gear.find((x) => x.uid === p.equipped[slot]);
            return (
              <li key={slot} className="rounded-2xl border border-dashed border-border p-3 text-sm">
                <p className="text-xs text-muted">{t(SLOTS[slot].vi, SLOTS[slot].en)}</p>
                {item ? (
                  <p className="font-semibold" style={{ color: QUALITIES[item.quality].color }}>
                    {item.name}
                  </p>
                ) : (
                  <p className="text-muted">—</p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel
        title={t(`Túi trang bị: ${p.gear.length}/${bagSize(p)}`, `Gear bag: ${p.gear.length}/${bagSize(p)}`)}
        subtitle={t("Trữ vật giới tốt hơn thì chứa được nhiều hơn.", "A better storage ring carries more.")}
      >
        {p.gear.length === 0 ? (
          <p className="text-sm text-muted">{t("Chưa có gì. Tìm trang bị trong bí cảnh.", "Nothing yet. Find gear in secret realms.")}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {p.gear.map((item) => {
              const on = equipped.has(item.uid);
              const q = QUALITIES[item.quality];
              return (
                <li key={item.uid} className={cn("flex flex-col gap-2 rounded-2xl border p-3", on ? "border-primary bg-primary/8" : "border-border")}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold" style={{ color: q.color }}>
                      {item.name}
                    </p>
                    <span className="text-xs text-muted">
                      {t(q.vi, q.en)} · {t(SLOTS[item.slot].vi, SLOTS[item.slot].en)} · T{item.tier + 1}
                    </span>
                  </div>
                  <StatGrid stats={gearStats(item)} t={t} />
                  <div className="flex gap-2">
                    <Button size="sm" variant={on ? "secondary" : "primary"} onClick={() => update((g) => equip(g, item.uid))}>
                      {on ? t("Tháo", "Take off") : t("Mặc", "Wear")}
                    </Button>
                    {!on && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          if (await confirm({ title: t(`Bán ${item.name}?`, `Sell ${item.name}?`), confirmLabel: `💎 ${gearPrice(item)}` }))
                            update((g) => sellGear(g, item.uid));
                        }}
                      >
                        {t("Bán", "Sell")} · 💎{gearPrice(item)}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function BagTab({ game, t, update, toast }: { game: Game; t: T; update: Update; toast: Toast }) {
  const p = game.player;
  const items = (Object.entries(p.bag) as [ItemId, number][]).filter(([, n]) => n > 0);
  const usable = (id: ItemId) => isSlip(id) || ["hoi-xuan", "dai-hoi-xuan", "hoi-linh", "tu-khi", "boi-nguyen"].includes(id);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={t("Túi đồ", "Bag")} subtitle={t("Đan dược và phù lục mang theo vào bí cảnh.", "Pills and talismans come with you into realms.")}>
        {items.length === 0 ? (
          <p className="text-sm text-muted">{t("Trống.", "Empty.")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map(([id, n]) => (
              <li key={id} className="flex items-center gap-3 rounded-2xl bg-surface-muted px-3 py-2">
                <Backpack className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {t(ITEMS[id].vi, ITEMS[id].en)} × {n}
                  </p>
                  <p className="text-xs text-muted">{t(ITEMS[id].about, ITEMS[id].aboutEn)}</p>
                </div>
                {usable(id) && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!update((g) => usePillAtHome(g, id))) toast(t("Không cần dùng lúc này.", "No need right now."), { tone: "info" });
                    }}
                  >
                    {ITEMS[id].kind === "scroll" ? t("Học", "Learn") : t("Dùng", "Use")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={t("Phường thị", "Market")} subtitle={`💎 ${p.stones}`}>
        <ul className="flex flex-col gap-2">
          {shopFor(p).map((id) => (
            <li key={id} className="flex items-center gap-3 rounded-2xl border border-border px-3 py-2">
              <div className="flex-1">
                <p className="text-sm font-semibold">{t(ITEMS[id].vi, ITEMS[id].en)}</p>
                <p className="text-xs text-muted">{t(ITEMS[id].about, ITEMS[id].aboutEn)}</p>
              </div>
              <Button size="sm" variant="primary" disabled={p.stones < ITEMS[id].price} onClick={() => update((g) => buy(g, id))}>
                💎 {ITEMS[id].price}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Realms({ game, t, onEnter }: { game: Game; t: T; onEnter: (realm: RealmId) => void }) {
  const p = game.player;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REALM_IDS.map((id) => {
        const realm = realmInfo(id);
        const open = p.major >= realm.minMajor;
        const suits = p.major === realm.minMajor;
        return (
          <section
            key={id}
            className={cn(
              "relative overflow-hidden rounded-3xl border bg-surface-strong p-6 shadow-card",
              suits ? "border-primary" : "border-border",
              !open && "opacity-60",
            )}
          >
            <InkHills />
            <div className="relative">
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">
                  {t(`${realm.floors} tầng · ${MAJOR_REALMS[realm.minMajor].vi}`, `${realm.floors} floors · ${MAJOR_REALMS[realm.minMajor].en}`)}
                </Badge>
                {suits && <Badge tone="success">{t("Hợp cảnh giới", "Your realm")}</Badge>}
              </div>
              <h3 className="mt-2 text-2xl font-extrabold">{t(realm.vi, realm.en)}</h3>
              <p className="mt-1 text-sm text-muted">{t(realm.about, realm.aboutEn)}</p>
              <p className="mt-2 text-xs text-muted">
                {t("Linh thảo", "Herb")}: {t(ITEMS[realm.herb].vi, ITEMS[realm.herb].en)} · {t("Yêu thú cấp", "Enemy level")} {realm.firstLevel}–
                {realm.boss.level}
              </p>
              {open ? (
                <Button variant={suits ? "primary" : "secondary"} className="mt-4" onClick={() => onEnter(id)}>
                  <Mountain className="h-4 w-4" aria-hidden="true" /> {t("Vào bí cảnh", "Enter")}
                </Button>
              ) : (
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-muted">
                  <Lock className="h-4 w-4" aria-hidden="true" /> {t(`Cần ${MAJOR_REALMS[realm.minMajor].vi}`, `Needs ${MAJOR_REALMS[realm.minMajor].en}`)}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
