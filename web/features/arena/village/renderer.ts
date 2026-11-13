// Stage 24 · Giữ Làng: draws the village with PixiJS at the screen's own frame rate.
// The game advances 20 times a second (in your browser when solo, on the game server in co-op). Spirits are drawn
// a little in the past, sliding smoothly between two updates; arrows fly, drums ring, coins pop: effects live here only.

import { Application, Container, Graphics, Sprite, Text, type Ticker } from "pixi.js";
import { makeVillageTextures, TILE, type VillageTextures } from "./art";
import { buildSpots, COLS, MAPS, ROWS, stats, type MapId, type VillageView } from "./village";

export type VillageRendererOptions = {
  onTap: (tx: number, ty: number) => void;
  onFps?: (fps: number) => void;
};
export type Selection = { tx: number; ty: number; range: number | null; mine: boolean } | null;
export type VillageRenderer = {
  push: (view: VillageView) => void;
  select: (s: Selection) => void;
  /** co-op: which side's spots are yours (null = all) */
  setSide: (side: 0 | 1 | null) => void;
  destroy: () => void;
};

const DELAY = 70; // ms in the past for smooth movement

export async function createVillageRenderer(host: HTMLElement, opts: VillageRendererOptions): Promise<VillageRenderer> {
  const app = new Application();
  await app.init({
    width: COLS * TILE,
    height: ROWS * TILE,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: "webgl",
  });
  app.ticker.maxFPS = 0;
  const canvas = app.canvas;
  Object.assign(canvas.style, { width: "100%", height: "auto", display: "block", touchAction: "manipulation" });
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const bg = new Sprite();
  const spotsLayer = new Graphics();
  const auraLayer = new Container();
  auraLayer.blendMode = "add";
  const actors = new Container();
  actors.sortableChildren = true;
  const fx = new Container();
  const ui = new Graphics();
  const bars = new Graphics();
  app.stage.addChild(bg, spotsLayer, auraLayer, actors, fx, bars, ui);

  let tex: VillageTextures | null = null;
  let map: MapId | null = null;
  let side: 0 | 1 | null = null;
  let selection: Selection = null;
  const granarySprite = new Sprite();
  granarySprite.anchor.set(0.5, 0.85);
  actors.addChild(granarySprite);
  const snaps: { at: number; v: VillageView }[] = [];

  function setMap(id: MapId) {
    map = id;
    tex?.destroy();
    tex = makeVillageTextures(app.renderer, id);
    bg.texture = tex.background;
    bg.width = COLS * TILE;
    bg.height = ROWS * TILE;
    granarySprite.texture = tex.granary;
    const end = MAPS[id].paths[0].at(-1)!;
    granarySprite.position.set(end[0] * TILE + 24, end[1] * TILE + 40);
    granarySprite.zIndex = end[1] * TILE + 40;
    drawSpots();
  }
  function drawSpots() {
    spotsLayer.clear();
    if (!map) return;
    for (const s of buildSpots(map)) {
      const mine = side === null || s.side === side;
      spotsLayer.roundRect(s.tx * TILE + 6, s.ty * TILE + 6, TILE - 12, TILE - 12, 8).fill({ color: 0xffffff, alpha: mine ? 0.13 : 0.04 });
    }
  }

  // Sprites kept by id
  const towerSprites = new Map<number, { s: Sprite; aura: Sprite | null; key: string }>();
  const spiritSprites = new Map<number, { s: Sprite; shadow: Sprite | null }>();
  type Fx = { s: Sprite | Text; life: number; max: number; update: (k: number) => void };
  const effects: Fx[] = [];
  const addFx = (s: Sprite | Text, ms: number, update: (k: number, s: Sprite | Text) => void) => {
    fx.addChild(s);
    effects.push({ s, life: ms, max: ms, update: (k) => update(k, s) });
  };
  const textPool: Text[] = [];
  const coinText = (x: number, y: number, n: number) => {
    const t = textPool.pop() ?? new Text({ text: "", style: { fontFamily: "system-ui, sans-serif", fontSize: 13, fontWeight: "800", fill: 0xffe08a, stroke: { color: 0x5a3a1c, width: 3 } } });
    t.text = `+${n}`;
    t.anchor.set(0.5);
    t.alpha = 1;
    addFx(t, 800, (k, s) => {
      s.position.set(x * TILE, y * TILE - 10 - k * 24);
      s.alpha = 1 - k;
    });
  };

  function push(view: VillageView) {
    if (view.map !== map) setMap(view.map);
    snaps.push({ at: performance.now(), v: view });
    if (snaps.length > 8) snaps.shift();
    if (!tex) return;
    // towers: add, change, remove
    const seen = new Set<number>();
    for (const t of view.towers) {
      seen.add(t.id);
      const key = `${t.kind}:${t.level}:${t.branch}`;
      let entry = towerSprites.get(t.id);
      if (!entry) {
        const s = new Sprite(tex.tower(t.kind, t.level, t.branch));
        s.anchor.set(0.5, 0.88);
        s.position.set(t.tx * TILE + 24, t.ty * TILE + 42);
        s.zIndex = t.ty * TILE + 42; // drawn in order of their feet: nearer things in front
        s.scale.set(0.2);
        actors.addChild(s);
        entry = { s, aura: null, key };
        towerSprites.set(t.id, entry);
      } else if (entry.key !== key) {
        entry.s.texture = tex.tower(t.kind, t.level, t.branch);
        entry.s.scale.set(1.25); // a little "upgraded!" bounce
        entry.key = key;
      }
      if (t.kind === "lantern") {
        const range = (stats("lantern", t.level, t.branch) as { range: number }).range;
        if (!entry.aura) {
          entry.aura = new Sprite(tex.aura);
          entry.aura.anchor.set(0.5);
          auraLayer.addChild(entry.aura);
        }
        entry.aura.position.set(t.tx * TILE + 24, t.ty * TILE + 24);
        entry.aura.width = entry.aura.height = range * 2 * TILE;
        entry.aura.tint = t.branch === "b" ? 0xff9a4a : 0xffffff;
      }
    }
    for (const [id, e] of towerSprites)
      if (!seen.has(id)) {
        e.s.destroy();
        e.aura?.destroy();
        towerSprites.delete(id);
      }
    // effects
    for (const e of view.events) {
      if (e.t === "shot") {
        const from = view.towers.find((t) => t.id === e.from);
        if (!from) continue;
        const s = new Sprite(e.kind === "kite" ? tex.kite : tex.arrow);
        s.anchor.set(0.5);
        const fx0 = from.tx * TILE + 24;
        const fy0 = from.ty * TILE + 10;
        const fx1 = e.x * TILE;
        const fy1 = e.y * TILE;
        s.rotation = Math.atan2(fy1 - fy0, fx1 - fx0);
        addFx(s, 130, (k, sp) => sp.position.set(fx0 + (fx1 - fx0) * k, fy0 + (fy1 - fy0) * k - Math.sin(k * Math.PI) * 10));
      } else if (e.t === "boom") {
        const from = view.towers.find((t) => t.id === e.from);
        if (!from) continue;
        const range = (stats("drum", from.level, from.branch) as { range: number }).range;
        const s = new Sprite(tex.ring);
        s.anchor.set(0.5);
        s.position.set(from.tx * TILE + 24, from.ty * TILE + 24);
        addFx(s, 450, (k, sp) => {
          sp.width = sp.height = range * 2 * TILE * (0.3 + 0.7 * k);
          sp.alpha = 1 - k;
        });
        const drum = towerSprites.get(from.id);
        if (drum) drum.s.scale.set(1.15);
      } else if (e.t === "pop" || e.t === "split") {
        for (let i = 0; i < 6; i++) {
          const s = new Sprite(tex.puff);
          s.anchor.set(0.5);
          const a = (i / 6) * Math.PI * 2;
          addFx(s, 450, (k, sp) => {
            sp.position.set(e.x * TILE + Math.cos(a) * 18 * k, e.y * TILE + Math.sin(a) * 18 * k - 8 * k);
            sp.alpha = 1 - k;
            sp.scale.set(0.6 + k);
          });
        }
        if (e.t === "pop") coinText(e.x, e.y, e.coins);
      } else if (e.t === "coins") coinText(e.x, e.y, e.coins);
    }
  }

  function frame(ticker: Ticker) {
    const dt = Math.min(ticker.deltaMS, 100);
    const latest = snaps.at(-1);
    if (!latest || !tex) return;
    const renderAt = performance.now() - DELAY;
    let a = snaps[0];
    let b = snaps[0];
    for (const s of snaps) {
      if (s.at <= renderAt) a = s;
      if (s.at >= renderAt) {
        b = s;
        break;
      }
      b = s;
    }
    const k = b.at > a.at ? Math.max(0, Math.min(1, (renderAt - a.at) / (b.at - a.at))) : 1;
    const now = performance.now();

    // towers settle after a bounce; lantern light breathes
    for (const e of towerSprites.values()) {
      const target = 1;
      e.s.scale.set(e.s.scale.x + (target - e.s.scale.x) * Math.min(1, dt / 90));
      if (e.aura) e.aura.alpha = 0.75 + Math.sin(now / 400) * 0.15;
    }

    // spirits
    bars.clear();
    const seen = new Set<number>();
    for (const sp of b.v.spirits) {
      seen.add(sp.id);
      const before = a.v.spirits.find((x) => x.id === sp.id) ?? sp;
      const x = (before.x + (sp.x - before.x) * k) * TILE;
      const y = (before.y + (sp.y - before.y) * k) * TILE;
      let entry = spiritSprites.get(sp.id);
      const flying = sp.kind === "crane";
      if (!entry) {
        const s = new Sprite(tex.spirit[sp.kind]);
        s.anchor.set(0.5, 0.8);
        actors.addChild(s);
        let shadow: Sprite | null = null;
        if (flying) {
          shadow = new Sprite(tex.puff);
          shadow.tint = 0x000000;
          shadow.alpha = 0.25;
          shadow.anchor.set(0.5);
          shadow.scale.set(1, 0.4);
          actors.addChild(shadow);
        }
        entry = { s, shadow };
        spiritSprites.set(sp.id, entry);
      }
      const hop = sp.stunned ? 0 : sp.kind === "rabbit" ? Math.abs(Math.sin(now / 220 + sp.id)) * 10 : Math.abs(Math.sin(now / 140 + sp.id)) * 3;
      const lift = flying ? 22 + Math.sin(now / 300 + sp.id) * 4 : 0;
      entry.s.position.set(x, y + 10 - hop - lift);
      entry.s.zIndex = flying ? 100_000 : y + 10;
      entry.s.rotation = sp.stunned ? Math.sin(now / 60) * 0.15 : 0;
      entry.s.tint = sp.stunned ? 0xc8d8ff : 0xffffff;
      if (entry.shadow) entry.shadow.position.set(x, y + 12);
      // health bar
      if (sp.hp < sp.maxHp) {
        const w = sp.kind === "rabbit" ? 44 : 26;
        const top = y + 10 - lift - (sp.kind === "rabbit" ? 74 : 40);
        bars.rect(x - w / 2, top, w, 4).fill({ color: 0x000000, alpha: 0.5 });
        bars.rect(x - w / 2, top, (w * sp.hp) / sp.maxHp, 4).fill(sp.hp / sp.maxHp > 0.4 ? 0x7fe07a : 0xff6a4a);
      }
    }
    for (const [id, e] of spiritSprites)
      if (!seen.has(id)) {
        e.s.destroy();
        e.shadow?.destroy();
        spiritSprites.delete(id);
      }

    // effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const e = effects[i];
      e.life -= dt;
      if (e.life <= 0) {
        if (e.s instanceof Text) {
          fx.removeChild(e.s);
          textPool.push(e.s);
        } else e.s.destroy();
        effects.splice(i, 1);
        continue;
      }
      e.update(1 - e.life / e.max);
    }

    // the selected tile: a frame, and the reach of the defender
    ui.clear();
    if (selection) {
      const { tx, ty, range, mine } = selection;
      if (range) ui.circle(tx * TILE + 24, ty * TILE + 24, range * TILE).fill({ color: 0xffffff, alpha: 0.12 }).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
      ui.roundRect(tx * TILE + 3, ty * TILE + 3, TILE - 6, TILE - 6, 8).stroke({ width: 3, color: mine ? 0xffe08a : 0xff6a4a });
    }

    if (opts.onFps && now - fpsAt > 1000) {
      fpsAt = now;
      opts.onFps(Math.round(app.ticker.FPS));
    }
  }
  let fpsAt = 0;
  app.ticker.add(frame);

  // Taps: which tile?
  canvas.addEventListener("pointerup", (e) => {
    const r = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const ty = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
    if (tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS) opts.onTap(tx, ty);
  });

  return {
    push,
    select: (s) => (selection = s),
    setSide: (s) => {
      side = s;
      drawSpots();
    },
    destroy() {
      app.ticker.remove(frame);
      tex?.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
