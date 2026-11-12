"use client";

// Stage 18: the asset gallery (/games/van-lo/assets). Every sprite Vân Lộ draws, animated, in light and dark.
// Handy for checking new art without playing to the 4th secret realm.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { ALLIES, ENEMIES, MAJOR_REALMS, PATHS, SECRET_REALMS, type AllyKind, type EnemyKind, type PathId, type RealmId } from "../logic/data";
import { DARK, drawAlly, drawEnemy, LIGHT, type Ink } from "./draw";
import { AMBIENT, Particles } from "./particles";
import { DECOS, drawProp, heroSprite, type Pose } from "./sprites";
import { useDark } from "./VanLo";

const SIZE = 64;
type Painter = (g: CanvasRenderingContext2D, now: number, ink: Ink, dark: boolean) => void;

// One small animated canvas
function Cell({ label, paint, dark, wide }: { label: string; paint: Painter; dark: boolean; wide?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const g = c.getContext("2d")!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wide ? SIZE * 3 : SIZE * 1.5;
    const h = SIZE * 1.5;
    c.width = w * dpr;
    c.height = h * dpr;
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      paint(g, now, dark ? DARK : LIGHT, dark);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paint, dark, wide]);
  return (
    <figure className="flex flex-col items-center gap-1">
      <canvas ref={ref} className="rounded-2xl bg-surface-muted" style={{ width: wide ? SIZE * 3 : SIZE * 1.5, height: SIZE * 1.5 }} />
      <figcaption className="max-w-24 text-center text-[0.7rem] leading-tight text-muted">{label}</figcaption>
    </figure>
  );
}

const center = { x: SIZE * 0.75, y: SIZE * 0.8 };
const POSES: Pose[] = ["idle", "walk", "attack", "hurt"];
const FRAME_MS: Record<Pose, number> = { idle: 520, walk: 90, attack: 110, hurt: 400 };

function hero(path: PathId, major: number, pose: Pose): Painter {
  return (g, now, _ink, dark) => {
    const dpr = g.getTransform().a;
    const s = Math.round(SIZE * dpr);
    const facing = pose === "walk" && Math.floor(now / 2000) % 2 ? -1 : 1;
    const sprite = heroSprite(path, major, pose, Math.floor(now / FRAME_MS[pose]), facing, dark, s);
    g.drawImage(sprite, center.x - SIZE, center.y - SIZE * 1.08, SIZE * 2, SIZE * 2);
  };
}

function enemy(kind: EnemyKind): Painter {
  const e = { uid: "e", kind, level: 1, pos: { x: 0, y: 0 }, hp: 8, maxHp: 10, awake: true, status: [], cooldown: 0 };
  return (g, _now, ink) => drawEnemy(g, e, center.x, center.y, ENEMIES[kind].boss ? SIZE * 0.7 : SIZE, ink);
}

function ally(kind: AllyKind): Painter {
  const a = { uid: "a", kind, pos: { x: 0, y: 0 }, hp: 10, maxHp: 10, atk: 1, def: 1, turns: 10 };
  return (g, _now, ink) => drawAlly(g, a, center.x, center.y, SIZE, ink);
}

function prop(kind: Parameters<typeof drawProp>[1]): Painter {
  return (g, now, ink) => drawProp(g, kind, center.x, center.y, SIZE, ink, now / 1000);
}

// A realm's air, in a wide box
function air(realm: RealmId | "tribulation"): Painter {
  const P = new Particles(120);
  let last = 0;
  let debt = 0;
  return (g, now) => {
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const a = AMBIENT[realm];
    debt += (a.rate * 4 * dt) / 1000;
    while (debt >= 1) {
      debt--;
      P.add({
        x: Math.random() * 3,
        y: 0.2 + Math.random() * 1.2,
        vx: (Math.random() - 0.5) * a.drift,
        vy: -a.rise * (0.6 + Math.random() * 0.8),
        gravity: 0,
        life: a.life,
        size: a.size,
        color: a.color[Math.floor(Math.random() * a.color.length)],
        shape: a.shape,
        spin: Math.random() * 6,
      });
    }
    P.update(dt);
    if (realm !== "tribulation") {
      g.fillStyle = SECRET_REALMS[realm].paper.dark;
      g.fillRect(0, 0, SIZE * 3, SIZE * 1.5);
    } else {
      g.fillStyle = "#0f0e14";
      g.fillRect(0, 0, SIZE * 3, SIZE * 1.5);
    }
    P.draw(g, SIZE, { x: 0, y: 0 });
  };
}

// Painters are made once, so each canvas keeps its own animation
function usePainters() {
  const [p] = useState(() => ({
    heroes: (Object.keys(PATHS) as PathId[]).map((id) => ({
      id,
      poses: POSES.map((pose) => hero(id, 0, pose)),
      realms: MAJOR_REALMS.map((_, m) => hero(id, m, "idle")),
    })),
    enemies: (Object.keys(ENEMIES) as EnemyKind[]).map((k) => ({ k, paint: enemy(k) })),
    allies: (Object.keys(ALLIES) as AllyKind[]).map((k) => ({ k, paint: ally(k) })),
    props: ([...DECOS, "urn", "crate", "shrine", "shrine-used", "merchant"] as const).map((k) => ({ k, paint: prop(k) })),
    air: ([...(Object.keys(SECRET_REALMS) as RealmId[]), "tribulation"] as const).map((k) => ({ k, paint: air(k) })),
  }));
  return p;
}

const PROP_NAMES: Record<string, [string, string]> = {
  torch: ["Đuốc", "Torch"],
  lantern: ["Đèn lồng", "Lantern"],
  bones: ["Xương", "Bones"],
  banner: ["Cờ", "Banner"],
  statue: ["Tượng đá", "Statue"],
  bush: ["Bụi cây", "Bush"],
  crystal: ["Tinh thạch", "Crystal"],
  rock: ["Đá", "Rock"],
  mushroom: ["Nấm", "Mushroom"],
  flowers: ["Hoa", "Flowers"],
  coral: ["San hô", "Coral"],
  spear: ["Giáo gãy", "Broken spear"],
  skull: ["Sọ", "Skull"],
  campfire: ["Lửa trại", "Campfire"],
  urn: ["Chum (đập được)", "Urn (breakable)"],
  crate: ["Thùng (đập được)", "Crate (breakable)"],
  shrine: ["Thần đàn", "Shrine"],
  "shrine-used": ["Thần đàn (đã cầu)", "Shrine (used)"],
  merchant: ["Thương nhân", "Merchant"],
};

export function Assets() {
  const dark = useDark();
  const [vi, setVi] = useState(true);
  const t = (a: string, b: string) => (vi ? a : b);
  const p = usePainters();
  const poseName: Record<Pose, [string, string]> = { idle: ["Đứng", "Idle"], walk: ["Đi", "Walk"], attack: ["Đánh", "Attack"], hurt: ["Trúng đòn", "Hurt"] };

  return (
    <div data-palette="ink" className="flex flex-col gap-6 rounded-3xl bg-background p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/games/van-lo" className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Vân Lộ
        </Link>
        <button
          type="button"
          onClick={() => setVi(!vi)}
          className="cursor-pointer rounded-full border border-border bg-surface-strong px-3 py-1 text-xs font-semibold"
        >
          {vi ? "English" : "Tiếng Việt"}
        </button>
      </div>
      <header>
        <h1 className="text-2xl font-extrabold">{t("Kho hình Vân Lộ", "Vân Lộ asset gallery")}</h1>
        <p className="text-sm text-muted">
          {t(
            "Mọi nhân vật, quái và đồ vật đều được vẽ bằng code (không có file ảnh), rồi lưu vào bộ nhớ đệm để vẽ nhanh.",
            "Every character, monster and prop is drawn in code (no image files), then cached so each frame is quick to draw.",
          )}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("Sáu con đường", "The six paths")}</h2>
        {p.heroes.map((h) => (
          <div key={h.id} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold" style={{ color: `color-mix(in srgb, ${PATHS[h.id].color} 55%, var(--text))` }}>
              {t(PATHS[h.id].vi, PATHS[h.id].en)}
            </h3>
            <div className="flex flex-wrap gap-2">
              {h.poses.map((paint, i) => (
                <Cell key={POSES[i]} label={t(...poseName[POSES[i]])} paint={paint} dark={dark} />
              ))}
              {h.realms.slice(1).map((paint, i) => (
                <Cell key={i} label={t(MAJOR_REALMS[i + 1].vi, MAJOR_REALMS[i + 1].en)} paint={paint} dark={dark} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("Yêu thú, quỷ và Tâm Ma", "Beasts, spirits and the Heart Demon")}</h2>
        <div className="flex flex-wrap gap-2">
          {p.enemies.map((e) => (
            <Cell key={e.k} label={t(ENEMIES[e.k].vi, ENEMIES[e.k].en)} paint={e.paint} dark={dark} />
          ))}
          {p.allies.map((a) => (
            <Cell key={a.k} label={t(ALLIES[a.k].vi, ALLIES[a.k].en)} paint={a.paint} dark={dark} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("Đồ vật và trang trí", "Props and decorations")}</h2>
        <div className="flex flex-wrap gap-2">
          {p.props.map((x) => (
            <Cell key={x.k} label={t(...PROP_NAMES[x.k])} paint={x.paint} dark={dark} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{t("Không khí mỗi bí cảnh", "Each realm's air")}</h2>
        <div className="flex flex-wrap gap-2">
          {p.air.map((x) => (
            <Cell
              key={x.k}
              wide
              label={x.k === "tribulation" ? t("Thiên kiếp", "Tribulation") : t(SECRET_REALMS[x.k].vi, SECRET_REALMS[x.k].en)}
              paint={x.paint}
              dark={dark}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
