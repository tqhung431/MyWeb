"use client";

// Stage 26 · Mầm Thú: the adventure. Walk the island (arrows/WASD, a D-pad on phones, or tap where to go), talk to
// villagers (Space/Enter or the talk button), rest at shrines, meet wild sproutlings in the tall grass, befriend
// them, and battle the six shrine keepers. Everything runs in your browser; the game saves as you go.

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, LogOut, MessageCircle, Users, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { isMuted, setMuted } from "@/features/arcade/sfx";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/I18nProvider";
import { Befriend } from "./Befriend";
import { BattleView } from "./BattleView";
import { Creature } from "./Creature";
import { IslandCanvas, type IslandState, type Pos } from "./IslandCanvas";
import { AREAS, findTile, pathTo, tileAt, walkable } from "./island";
import { MOVE_NAMES } from "./names";
import { saveGame, TEAM_MAX, type SproutSave } from "./save";
import * as S from "./sprout";
import { play } from "./sound";
import { TeamPanel } from "./TeamPanel";

type Mode =
  | { k: "island" }
  | { k: "talk"; who: string; lines: string[]; i: number; then?: () => void }
  | { k: "battle"; battle: S.Battle; label: string; keeper: number | null }
  | { k: "befriend"; species: S.SpeciesId; level: number; hp: number; bonus: number }
  | { k: "team"; place: "shrine" | "home" | null }
  | { k: "result"; title: string; lines: string[]; species?: S.SpeciesId };

const STEP_MS = 170;
const DIRS: Record<string, [number, number, Pos["dir"]]> = {
  ArrowUp: [0, -1, 3],
  KeyW: [0, -1, 3],
  ArrowDown: [0, 1, 0],
  KeyS: [0, 1, 0],
  ArrowLeft: [-1, 0, 1],
  KeyA: [-1, 0, 1],
  ArrowRight: [1, 0, 2],
  KeyD: [1, 0, 2],
};
const hexColor = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function SproutGame({ initial, signedIn, onQuit }: { initial: SproutSave; signedIn: boolean; onQuit: () => void }) {
  const t = useT();
  const save = useRef(initial).current;
  const [, redraw] = useState(0);
  const refresh = () => redraw((n) => n + 1);
  const [mode, setModeState] = useState<Mode>({ k: "island" });
  const modeRef = useRef(mode);
  const setMode = (m: Mode) => {
    modeRef.current = m;
    setModeState(m);
  };
  const [muted, setMute] = useState(false);
  const [touch, setTouch] = useState(false);
  const area = AREAS[save.area];
  const here = (x: number, y: number): Pos => ({ x, y, dir: 0 });
  const island = useRef<IslandState>({
    area,
    gateOpen: save.keepers.includes(save.area),
    keeperBeaten: save.keepers.includes(save.area),
    player: { from: here(save.x, save.y), to: here(save.x, save.y), at: 0, ms: 1 },
  });
  const held = useRef<[number, number, Pos["dir"]][]>([]);
  const route = useRef<[number, number][]>([]);
  const pendingTalk = useRef<[number, number] | null>(null);
  const sinceEncounter = useRef(0);
  // Each screen (island, battle, befriending, team) starts at the top of the game, also on a phone
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = top.current?.getBoundingClientRect();
    if (box && (box.top < 0 || box.top > window.innerHeight * 0.4)) top.current!.scrollIntoView({ block: "start" });
  }, [mode.k]);

  useEffect(() => {
    setMute(isMuted());
    setTouch(window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
  }, []);
  const persist = useCallback((force = false) => saveGame(save, signedIn, force), [save, signedIn]);
  useEffect(() => {
    const away = () => persist(true);
    window.addEventListener("pagehide", away);
    return () => {
      window.removeEventListener("pagehide", away);
      persist(true);
    };
  }, [persist]);

  function syncIsland() {
    const s = island.current;
    s.area = AREAS[save.area];
    s.gateOpen = save.keepers.includes(save.area);
    s.keeperBeaten = s.gateOpen;
  }
  function placeAt(areaIdx: number, x: number, y: number) {
    save.area = areaIdx;
    save.x = x;
    save.y = y;
    syncIsland();
    const p = here(x, y);
    island.current.player = { from: p, to: p, at: 0, ms: 1 };
    route.current = [];
    refresh();
  }
  const healAll = () => [...save.team, ...save.home].forEach((c) => (c.hp = S.statsOf(c).hp));

  // --- walking -----------------------------------------------------------------------------------
  const facing = () => {
    const d = island.current.player.to.dir;
    const [dx, dy] = d === 0 ? [0, 1] : d === 1 ? [-1, 0] : d === 2 ? [1, 0] : [0, -1];
    return [save.x + dx, save.y + dy] as [number, number];
  };
  function step(dx: number, dy: number, dir: Pos["dir"]) {
    const p = island.current.player;
    const a = AREAS[save.area];
    const nx = save.x + dx;
    const ny = save.y + dy;
    if (!walkable(a, nx, ny, save.keepers.includes(save.area))) {
      p.to = { ...p.to, dir };
      return false;
    }
    const from = { x: save.x, y: save.y, dir };
    save.x = nx;
    save.y = ny;
    save.steps++;
    island.current.player = { from, to: { x: nx, y: ny, dir }, at: performance.now(), ms: STEP_MS };
    arrive(nx, ny);
    return true;
  }
  function arrive(x: number, y: number) {
    const a = AREAS[save.area];
    const tile = tileAt(a, x, y);
    if (tile === "<" && save.area > 0) {
      const prev = AREAS[save.area - 1];
      const gate = findTile(prev, "G")!;
      setTimeout(() => placeAt(save.area - 1, gate[0] - 1, y), STEP_MS);
      return;
    }
    if (tile === "G") {
      const next = AREAS[save.area + 1];
      setTimeout(() => {
        placeAt(save.area + 1, next.enter[0], next.enter[1]);
        persist(true);
        setMode({ k: "result", title: next.name, lines: [t(next.en)] });
      }, STEP_MS);
      return;
    }
    sinceEncounter.current++;
    if (tile === ",") {
      play("grass");
      if (sinceEncounter.current > 3 && Math.random() < 0.13) {
        sinceEncounter.current = 0;
        route.current = [];
        held.current = [];
        setTimeout(() => encounter(), STEP_MS + 60);
      }
    }
    if (save.steps % 25 === 0) persist();
  }
  function encounter() {
    const a = AREAS[save.area];
    let r = Math.random() * a.wild.reduce((n, w) => n + w.weight, 0);
    let species = a.wild[0].species;
    for (const w of a.wild) if ((r -= w.weight) < 0) {
      species = w.species;
      break;
    }
    const level = a.levels[0] + Math.floor(Math.random() * (a.levels[1] - a.levels[0] + 1));
    if (!save.seen.includes(species)) save.seen.push(species);
    play("encounter");
    startBattle([S.makeCreature(-1, species, level)], true, "", null);
  }
  function startBattle(theirs: S.Creature[], wild: boolean, label: string, keeper: number | null) {
    const ready = [...save.team.filter((c) => c.hp > 0), ...save.team.filter((c) => c.hp <= 0)];
    const battle = S.newBattle(ready, theirs, (save.seed + save.battles * 7919) >>> 0, wild);
    save.battles++;
    setMode({ k: "battle", battle, label, keeper });
  }

  // The walking loop: keys held, or a route from a tap
  useEffect(() => {
    const id = setInterval(() => {
      if (modeRef.current.k !== "island") return;
      const p = island.current.player;
      if (performance.now() - p.at < p.ms) return;
      if (route.current.length) {
        const [x, y] = route.current.shift()!;
        const dx = x - save.x;
        const dy = y - save.y;
        const dir: Pos["dir"] = dy > 0 ? 0 : dx < 0 ? 1 : dx > 0 ? 2 : 3;
        if (!step(dx, dy, dir)) route.current = [];
        else if (!route.current.length && pendingTalk.current) {
          const [tx, ty] = pendingTalk.current;
          pendingTalk.current = null;
          const d2: Pos["dir"] = ty > save.y ? 0 : tx < save.x ? 1 : tx > save.x ? 2 : 3;
          island.current.player.to.dir = d2;
          setTimeout(() => interact(tx, ty), STEP_MS);
        }
        return;
      }
      const h = held.current.at(-1);
      if (h) step(h[0], h[1], h[2]);
    }, 30);
    return () => clearInterval(id);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // --- talking, the shrine, the keeper ---------------------------------------------------------
  function interact(x: number, y: number) {
    const a = AREAS[save.area];
    const tile = tileAt(a, x, y);
    if (tile === "V") {
      const v = a.villagers.find((q) => q.x === x && q.y === y);
      if (v) {
        play("talk");
        setMode({ k: "talk", who: v.name, lines: v.lines.map((l) => t(l)), i: 0 });
      }
    } else if (tile === "K") {
      play("talk");
      const k = a.keeper;
      if (save.keepers.includes(save.area)) setMode({ k: "talk", who: k.name, lines: [t(k.after)], i: 0 });
      else if (!save.team.some((c) => c.hp > 0)) setMode({ k: "talk", who: k.name, lines: [t("Your sproutlings look tired. Rest at the shrine first!")], i: 0 });
      else
        setMode({
          k: "talk",
          who: `${k.name} · ${t(k.title)}`,
          lines: [t(k.before)],
          i: 0,
          then: () => startBattle(k.team.map(([sp, l], i) => S.makeCreature(-10 - i, sp, l)), false, k.name, save.area),
        });
    } else if (tile === "S") {
      healAll();
      play("heal");
      persist(true);
      setMode({ k: "team", place: "shrine" });
    } else if (tile === "H") {
      healAll();
      play("heal");
      setMode({ k: "team", place: "home" });
    }
  }
  const talkNext = () => {
    const m = modeRef.current;
    if (m.k !== "talk") return;
    if (m.i + 1 < m.lines.length) return setMode({ ...m, i: m.i + 1 });
    setMode({ k: "island" });
    m.then?.();
  };

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const m = modeRef.current;
      if (m.k === "talk" || m.k === "result") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          if (m.k === "talk") talkNext();
          else setMode({ k: "island" });
        }
        return;
      }
      if (m.k !== "island") return;
      const d = DIRS[e.code];
      if (d) {
        e.preventDefault();
        route.current = [];
        if (!held.current.some((h) => h[2] === d[2])) held.current.push(d);
      } else if (e.code === "Space" || e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        interact(...facing());
      } else if (e.code === "KeyT") setMode({ k: "team", place: null });
    };
    const up = (e: KeyboardEvent) => {
      const d = DIRS[e.code];
      if (d) held.current = held.current.filter((h) => h[2] !== d[2]);
    };
    const blur = () => (held.current = []);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const tap = (x: number, y: number) => {
    if (modeRef.current.k !== "island") return;
    const a = AREAS[save.area];
    const tile = tileAt(a, x, y);
    const talkable = "VKSH".includes(tile);
    if (talkable && Math.abs(x - save.x) + Math.abs(y - save.y) === 1) {
      island.current.player.to.dir = y > save.y ? 0 : x < save.x ? 1 : x > save.x ? 2 : 3;
      return interact(x, y);
    }
    const path = pathTo(a, [save.x, save.y], [x, y], save.keepers.includes(save.area));
    if (!path) return;
    route.current = path;
    pendingTalk.current = talkable ? [x, y] : null;
  };

  // --- after a battle ------------------------------------------------------------------------------
  function battleOver(b: S.Battle, keeper: number | null) {
    // health comes back to your team as it was at the end
    for (const f of b.sides[0].team) {
      const c = save.team.find((x) => x.uid === f.uid);
      if (c) c.hp = Math.max(0, f.hp);
    }
    const lines: string[] = [];
    if (b.ended === "befriend") {
      const w = S.activeOf(b, 1);
      setMode({ k: "befriend", species: w.species, level: w.level, hp: w.hp, bonus: S.befriendBonus(w, save.team[0]) });
      return;
    }
    if (b.ended === "win") {
      const beaten = b.sides[1].team.filter((c) => c.hp <= 0);
      const total = beaten.reduce((n, c) => n + S.xpFor(c), 0);
      const fighters = b.sides[0].team.filter((f) => f.hp > 0).map((f) => save.team.find((c) => c.uid === f.uid)!);
      for (const c of fighters) {
        const got = Math.ceil(total / fighters.length);
        const r = S.gainXp(c, got);
        const name = S.SPECIES[c.species].name;
        lines.push(t("{name} +{n} XP", { name, n: got }));
        for (const l of r.levels) lines.push(t("{name} reached level {n}!", { name, n: l }));
        for (const m of r.learned) lines.push(t("{name} learned {move}!", { name, move: t(MOVE_NAMES[m]) }));
        if (r.levels.length && S.canGrow(c) && r.levels.includes(S.SPECIES[c.species].grows!.level)) lines.push(t("{name} is ready to grow. Visit a shrine!", { name }));
      }
      if (lines.some((l) => l.includes("level"))) play("level");
      if (keeper !== null) {
        save.keepers.push(keeper);
        syncIsland();
        persist(true);
        const k = AREAS[keeper].keeper;
        setMode({
          k: "talk",
          who: k.name,
          lines: [t(k.after), ...(keeper === AREAS.length - 1 ? [t("Every shrine on Thanh Khê is awake. You did it!")] : [t("The gate is open.")])],
          i: 0,
          then: () => setMode({ k: "result", title: t("Shrine awakened!"), lines }),
        });
        return;
      }
      persist();
      setMode(lines.length ? { k: "result", title: t("Well played!"), lines } : { k: "island" });
      return;
    }
    if (b.ended === "lose") {
      // back to this area's shrine, everyone rested
      healAll();
      const sh = findTile(AREAS[save.area], "S")!;
      placeAt(save.area, sh[0], sh[1] + 1);
      persist(true);
      setMode({ k: "result", title: t("Time for a rest"), lines: [t("Your sproutlings were tired, so you all went back to the shrine to rest.")] });
      return;
    }
    setMode({ k: "island" });
  }
  function befriendDone(m: Extract<Mode, { k: "befriend" }>, score: number) {
    const total = score + m.bonus;
    const name = S.SPECIES[m.species].name;
    if (total >= S.BEFRIEND_AT) {
      const c = S.makeCreature(save.nextUid++, m.species, m.level);
      c.hp = Math.max(1, Math.min(m.hp, S.statsOf(c).hp));
      const toTeam = save.team.length < TEAM_MAX;
      (toTeam ? save.team : save.home).push(c);
      if (!save.friends.includes(m.species)) save.friends.push(m.species);
      play("friend");
      persist(true);
      setMode({ k: "result", title: t("{name} is your friend now!", { name }), lines: [toTeam ? t("It joins your team.") : t("Your team is full, so it went to wait at your house.")], species: m.species });
    } else {
      play("shy");
      setMode({ k: "result", title: t("{name} ran off shyly", { name }), lines: [t("Trust {n}% (needs {need}%). Try again: calmer or sleepier sproutlings trust you more.", { n: Math.round(total * 100), need: Math.round(S.BEFRIEND_AT * 100) })] });
    }
  }

  // --- screen --------------------------------------------------------------------------------------
  const m = mode;
  const scene = `linear-gradient(180deg, ${hexColor(area.theme.water)}55 0%, ${hexColor(area.theme.ground)} 55%, ${hexColor(area.theme.grass)} 100%)`;
  const hold = (d: [number, number, Pos["dir"]]) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      route.current = [];
      held.current = [d];
    },
    onPointerUp: () => (held.current = []),
    onPointerCancel: () => (held.current = []),
  });

  const wrap = (node: React.ReactNode) => (
    <div ref={top} className="scroll-mt-3">
      {node}
    </div>
  );
  if (m.k === "battle")
    return wrap(
      <BattleView
        key={save.battles}
        battle={m.battle}
        foeLabel={m.label}
        scene={scene}
        onEnd={(b) => {
          save.team.forEach((c) => (c.hp = Math.max(0, c.hp)));
          battleOver(b, m.keeper);
          refresh();
        }}
      />,
    );
  if (m.k === "befriend") return wrap(<Befriend species={m.species} bonus={m.bonus} onDone={(s) => befriendDone(m, s)} />);
  if (m.k === "team")
    return wrap(
      <TeamPanel
        save={save}
        place={m.place}
        onChange={() => {
          persist();
          refresh();
        }}
        onClose={() => setMode({ k: "island" })}
        onGrow={(c) => {
          const before = S.SPECIES[c.species].name;
          if (!S.grow(c)) return;
          if (!save.friends.includes(c.species)) save.friends.push(c.species);
          if (!save.seen.includes(c.species)) save.seen.push(c.species);
          play("grow");
          persist(true);
          setMode({ k: "result", title: t("{a} grew into {b}!", { a: before, b: S.SPECIES[c.species].name }), lines: [], species: c.species });
        }}
      />,
    );

  return (
    <div ref={top} className="mx-auto flex w-full max-w-3xl scroll-mt-3 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <p className="min-w-0 flex-1 truncate font-bold">
          {area.name} <span className="font-normal text-muted">· {t(area.en)}</span>
        </p>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold shadow-sm" title={t("Shrines awakened")}>
          🏮 {save.keepers.length}/6
        </span>
        <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold shadow-sm" title={t("Kinds befriended")}>
          🌱 {save.friends.length}
        </span>
        <button
          type="button"
          onClick={() => {
            setMuted(!muted);
            setMute(!muted);
          }}
          aria-label={muted ? t("Sound on") : t("Sound off")}
          className="cursor-pointer rounded-full p-1 text-muted hover:text-text"
        >
          {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-3xl border-4 border-[#4a6a3a] bg-[#4a6a3a] shadow-card">
        <IslandCanvas state={island} onTap={tap} />
        {(m.k === "talk" || m.k === "result") && (
          <button
            type="button"
            onClick={() => (m.k === "talk" ? talkNext() : setMode({ k: "island" }))}
            className="absolute inset-x-2 bottom-2 cursor-pointer rounded-2xl border-2 border-[#4a3a2a] bg-[#fff8e8] p-3 text-left text-[#2a1a12] shadow-lg sm:inset-x-6 sm:bottom-4"
          >
            {m.k === "talk" ? (
              <>
                <span className="block text-xs font-extrabold text-[#8a5a2b]">{m.who}</span>
                <span className="block text-sm sm:text-base">{m.lines[m.i]}</span>
              </>
            ) : (
              <span className="flex items-center gap-3">
                {m.species && <Creature species={m.species} size={56} />}
                <span>
                  <span className="block font-extrabold">{m.title}</span>
                  {m.lines.slice(0, 6).map((l, i) => (
                    <span key={i} className="block text-xs sm:text-sm">
                      {l}
                    </span>
                  ))}
                </span>
              </span>
            )}
            <span className="absolute right-3 bottom-2 text-xs text-[#8a5a2b]">▼</span>
          </button>
        )}
      </div>

      {/* Your team at a glance */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setMode({ k: "team", place: null })} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-2xl border border-border bg-surface p-1.5 text-left">
          {save.team.map((c, i) => (
            <span key={c.uid} className={cn("relative shrink-0", i >= 3 && "opacity-60")} title={`${S.SPECIES[c.species].name} · ${t("Lv {n}", { n: c.level })}`}>
              <Creature species={c.species} size={36} />
              <span className="absolute inset-x-1 bottom-0 h-1 overflow-hidden rounded-full bg-black/15">
                <span className={cn("block h-full", c.hp / S.statsOf(c).hp < 0.3 ? "bg-rose-500" : "bg-emerald-500")} style={{ width: `${(100 * c.hp) / S.statsOf(c).hp}%` }} />
              </span>
            </span>
          ))}
          <span className="ml-auto flex items-center gap-1 pr-1 text-xs font-semibold text-muted">
            <Users className="h-4 w-4" aria-hidden="true" /> {t("Team")}
          </span>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            persist(true);
            onQuit();
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> {t("Save and leave")}
        </Button>
      </div>

      {touch ? (
        <div className="flex items-center justify-between px-2 pt-1 pb-6">
          <div className="grid grid-cols-3 grid-rows-3 gap-1" aria-label={t("Walk")}>
            <span />
            <button type="button" aria-label={t("Up")} className="grid h-14 w-14 touch-none place-items-center rounded-2xl bg-surface shadow-sm select-none active:bg-primary/20" {...hold(DIRS.ArrowUp)}>
              <ArrowUp className="h-6 w-6" aria-hidden="true" />
            </button>
            <span />
            <button type="button" aria-label={t("Left")} className="grid h-14 w-14 touch-none place-items-center rounded-2xl bg-surface shadow-sm select-none active:bg-primary/20" {...hold(DIRS.ArrowLeft)}>
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <span />
            <button type="button" aria-label={t("Right")} className="grid h-14 w-14 touch-none place-items-center rounded-2xl bg-surface shadow-sm select-none active:bg-primary/20" {...hold(DIRS.ArrowRight)}>
              <ArrowRight className="h-6 w-6" aria-hidden="true" />
            </button>
            <span />
            <button type="button" aria-label={t("Down")} className="grid h-14 w-14 touch-none place-items-center rounded-2xl bg-surface shadow-sm select-none active:bg-primary/20" {...hold(DIRS.ArrowDown)}>
              <ArrowDown className="h-6 w-6" aria-hidden="true" />
            </button>
            <span />
          </div>
          <button
            type="button"
            aria-label={t("Talk")}
            onClick={() => {
              const mm = modeRef.current;
              if (mm.k === "talk") talkNext();
              else if (mm.k === "result") setMode({ k: "island" });
              else interact(...facing());
            }}
            className="grid h-20 w-20 touch-none place-items-center rounded-full bg-primary text-white shadow-lg select-none"
          >
            <MessageCircle className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted">{t("Arrows or WASD: walk · Space: talk / next · T: your team · or click where to go")}</p>
      )}
    </div>
  );
}
