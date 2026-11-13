// Stage 25 · Chợ Đêm Brawl: draws the market with PixiJS (WebGL), at the screen's own rate.
//
// Like Ngõ Pháo: the server sends the game 20 times a second; everyone else is drawn 100 ms in the past, smoothly
// between two updates; YOUR hero walks at once with the same walking code as the server (moveCircle from brawl.ts)
// and is gently corrected when the server disagrees. Bonk stars, swing arcs, coins and confetti live only here.

import { Application, Container, Graphics, Sprite, Text, Texture, type Ticker } from "pixi.js";
import { H, HEROES, moveCircle, W, type BrawlEvent, type BrawlView, type HeroKind } from "./brawl";
import { HERO_COLOR, makeBrawlTextures, TILE, type BrawlTextures } from "./art";

export type BrawlTick = BrawlView & { code: string };
export type BrawlRendererOptions = {
  myId: string | null;
  serverNow: () => number;
  /** The stick you're pressing right now (-1..1) */
  myStick: () => [number, number];
  onEvent?: (e: BrawlEvent) => void;
};
export type BrawlRenderer = { push: (view: BrawlTick) => void; destroy: () => void };

const DELAY = 100;
const HERO_R = 0.36;
type Particle = { s: Sprite | Text; vx: number; vy: number; life: number; max: number; spin: number; grow: number; gravity: number };

export async function createBrawlRenderer(host: HTMLElement, opts: BrawlRendererOptions): Promise<BrawlRenderer> {
  const app = new Application();
  await app.init({
    width: W * TILE,
    height: H * TILE,
    backgroundColor: 0x1a1428,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: "webgl",
  });
  app.ticker.maxFPS = 0;
  const canvas = app.canvas;
  Object.assign(canvas.style, { width: "100%", height: "auto", display: "block" });
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const tex: BrawlTextures = makeBrawlTextures(app.renderer);
  const world = new Container();
  app.stage.addChild(world);
  const ground = new Sprite(Texture.EMPTY);
  ground.width = W * TILE;
  ground.height = H * TILE;
  const zoneLayer = new Container();
  const actorLayer = new Container();
  actorLayer.sortableChildren = true;
  const shotLayer = new Container();
  const fxLayer = new Container();
  const glowLayer = new Container();
  glowLayer.blendMode = "add";
  world.addChild(ground, zoneLayer, actorLayer, shotLayer, glowLayer, fxLayer);
  let area = -1;

  const snaps: BrawlTick[] = [];
  const me = { x: 0, y: 0, ready: false };
  let shake = 0;

  // --- particles -------------------------------------------------------------------------------
  const particles: Particle[] = [];
  const add = (s: Sprite | Text, p: Omit<Particle, "s">, layer = fxLayer) => {
    if (particles.length > 350) return;
    layer.addChild(s);
    particles.push({ s, ...p });
  };
  const burst = (texture: Texture, x: number, y: number, n: number, speed: number, life: number, o: { tint?: number; grow?: number; up?: number; gravity?: number; layer?: Container; scale?: number } = {}) => {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(texture);
      s.anchor.set(0.5);
      s.position.set(x, y);
      s.scale.set(o.scale ?? 1);
      if (o.tint) s.tint = o.tint;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      add(s, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - (o.up ?? 0), life: life * (0.7 + Math.random() * 0.5), max: life, spin: (Math.random() - 0.5) * 8, grow: o.grow ?? 0, gravity: o.gravity ?? 300 }, o.layer);
    }
  };
  const floatText = (text: string, x: number, y: number, color: number, size = 16) => {
    const s = new Text({ text, style: { fontFamily: "system-ui, sans-serif", fontSize: size, fontWeight: "900", fill: color, stroke: { color: 0x1a1428, width: 4 } } });
    s.anchor.set(0.5);
    s.position.set(x, y);
    add(s, { vx: (Math.random() - 0.5) * 30, vy: -70, life: 0.8, max: 0.8, spin: 0, grow: 0, gravity: 60 });
  };

  // --- heroes and enemies ----------------------------------------------------------------------
  type Actor = { root: Container; body: Sprite; ring: Graphics; bar: Graphics; label: Text | null; stars: Text; lastX: number; lastY: number; face: number; hurtAt: number; swingAt: number; swing: Sprite | null };
  const heroActors = new Map<string, Actor>();
  const enemyActors = new Map<number, Actor>();
  const makeActor = (label: string | null, color: number): Actor => {
    const root = new Container();
    const ring = new Graphics();
    const body = new Sprite(Texture.EMPTY);
    body.anchor.set(0.5, 0.9);
    const bar = new Graphics();
    const stars = new Text({ text: "✦ ✧ ✦", style: { fontSize: 13, fill: 0xffe08a } });
    stars.anchor.set(0.5);
    let text: Text | null = null;
    if (label) {
      text = new Text({ text: label, style: { fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: "800", fill: 0xffffff, stroke: { color: 0x1a1428, width: 3 } } });
      text.anchor.set(0.5, 1);
    }
    root.addChild(ring, body, bar, stars);
    if (text) root.addChild(text);
    if (color) ring.ellipse(0, 0, 22, 8).stroke({ width: 3, color, alpha: 0.9 });
    actorLayer.addChild(root);
    return { root, body, ring, bar, label: text, stars, lastX: 0, lastY: 0, face: 1, hurtAt: 0, swingAt: 0, swing: null };
  };

  // pools for shots and zones
  const pool = (layer: Container) => {
    const list: Sprite[] = [];
    let used = 0;
    return {
      begin: () => (used = 0),
      next: (t: Texture) => {
        let s = list[used];
        if (!s) {
          s = new Sprite(t);
          s.anchor.set(0.5);
          layer.addChild(s);
          list.push(s);
        }
        s.texture = t;
        s.visible = true;
        s.alpha = 1;
        s.rotation = 0;
        s.scale.set(1);
        used++;
        return s;
      },
      end: () => {
        for (let i = used; i < list.length; i++) list[i].visible = false;
      },
    };
  };
  const shots = pool(shotLayer);
  const zones = pool(zoneLayer);

  const px = (v: number) => v * TILE;

  function push(view: BrawlTick) {
    if (view.area !== area) {
      area = view.area;
      ground.texture = tex.background(area);
      ground.width = W * TILE;
      ground.height = H * TILE;
      snaps.length = 0; // a new area: everyone starts again on the left, don't slide them there
      me.ready = false;
    }
    snaps.push(view);
    if (snaps.length > 12) snaps.shift();
    for (const e of view.events) {
      opts.onEvent?.(e);
      if (e.t === "bonk") {
        burst(tex.star, px(e.x), px(e.y) - 20, 3, 140, 0.45, { up: 60 });
        floatText(String(e.damage), px(e.x), px(e.y) - 40, 0xffe08a, 15);
        const a = [...enemyActors.values()].find((x) => Math.hypot(x.lastX - e.x, x.lastY - e.y) < 0.5);
        if (a) a.hurtAt = performance.now();
      } else if (e.t === "away") {
        burst(tex.puff, px(e.x), px(e.y), 6, 60, 0.7, { grow: 1.2, up: 30, gravity: -20 });
        floatText("+", px(e.x), px(e.y) - 30, 0xf2c94c, 20);
      } else if (e.t === "swing") {
        const a = heroActors.get(e.id);
        if (a) {
          a.swingAt = performance.now();
          if (!a.swing) {
            a.swing = new Sprite(tex.swing[e.hero]);
            a.swing.anchor.set(0.5);
            fxLayer.addChild(a.swing);
          }
          a.swing.rotation = Math.atan2(e.fy, e.fx);
          a.swing.position.set(px(e.x + e.fx * 0.5), px(e.y + e.fy * 0.5) - 12);
        }
      } else if (e.t === "special") {
        shake = Math.max(shake, 8);
        const color = HERO_COLOR[e.hero as HeroKind];
        burst(tex.puff, px(e.x), px(e.y), 18, 260, 0.7, { tint: color, grow: 1.5, layer: glowLayer, gravity: 0 });
      } else if (e.t === "heal") {
        const h = view.heroes.find((x) => x.id === e.id);
        if (h) {
          burst(tex.heal, px(h.x), px(h.y) - 20, 6, 50, 0.9, { up: 60, gravity: -40, layer: glowLayer });
          floatText(`+${e.amount}`, px(h.x), px(h.y) - 50, 0x7fe07a, 15);
        }
      } else if (e.t === "hurt") {
        const a = heroActors.get(e.id);
        if (a) a.hurtAt = performance.now();
        if (e.id === opts.myId) shake = Math.max(shake, 4);
      } else if (e.t === "pop") {
        shake = Math.max(shake, 3);
        burst(tex.puff, px(e.x), px(e.y), 10, 140, 0.5, { tint: 0xff8fd0, gravity: 0 });
      } else if (e.t === "boss") shake = Math.max(shake, 10);
    }
  }

  function frame(ticker: Ticker) {
    const dt = Math.min(ticker.deltaMS, 100);
    const latest = snaps.at(-1);
    if (!latest) return;
    const now = opts.serverNow();
    const renderT = now - DELAY;
    let a = snaps[0];
    let b = snaps[0];
    for (const s of snaps) {
      if (s.t <= renderT) a = s;
      b = s;
      if (s.t >= renderT) break;
    }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (renderT - a.t) / (b.t - a.t))) : 1;
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const clock = performance.now();

    // Confetti zones
    zones.begin();
    for (const z of latest.zones) {
      const s = zones.next(tex.confetti);
      s.position.set(px(z.x), px(z.y));
      s.scale.set((z.r * TILE * 2) / 128);
      s.rotation = clock / 3000 + z.id;
    }
    zones.end();

    // Heroes
    const seen = new Set<string>();
    for (const h of latest.heroes) {
      seen.add(h.id);
      let act = heroActors.get(h.id);
      if (!act) heroActors.set(h.id, (act = makeActor(h.id === opts.myId ? null : h.name, HERO_COLOR[h.hero])));
      let x: number;
      let y: number;
      const mine = h.id === opts.myId;
      const canWalk = (latest.phase === "fight" || latest.phase === "pause") && !h.down && !h.dodging && !h.dashing;
      if (mine && canWalk) {
        // Prediction: walk now with the same rules as the server, then drift towards what the server says
        if (!me.ready) Object.assign(me, { x: h.x, y: h.y, ready: true });
        const [mx, my] = opts.myStick();
        const v = (HEROES[h.hero].speed * h.speedMul * dt) / 1000;
        [me.x, me.y] = moveCircle(latest.area, me.x, me.y, mx * v, my * v, HERO_R);
        const err = Math.hypot(me.x - h.x, me.y - h.y);
        if (err > 1.2) Object.assign(me, { x: h.x, y: h.y });
        else if (err > 0.05) Object.assign(me, { x: me.x + (h.x - me.x) * 0.08, y: me.y + (h.y - me.y) * 0.08 });
        x = me.x;
        y = me.y;
        if (Math.abs(mx) > 0.2) act.face = mx > 0 ? 1 : -1;
      } else {
        const ha = a.heroes.find((q) => q.id === h.id) ?? h;
        const hb = b.heroes.find((q) => q.id === h.id) ?? h;
        const far = Math.hypot(ha.x - hb.x, ha.y - hb.y) > 2;
        x = far ? hb.x : lerp(ha.x, hb.x);
        y = far ? hb.y : lerp(ha.y, hb.y);
        if (mine) Object.assign(me, { x, y, ready: true });
        if (Math.abs(h.fx) > 0.2) act.face = h.fx > 0 ? 1 : -1;
      }
      const moving = Math.hypot(x - act.lastX, y - act.lastY) > 0.002;
      act.lastX = x;
      act.lastY = y;
      act.root.position.set(px(x), px(y));
      act.root.zIndex = y * 100;
      act.body.texture = h.down ? tex.heroDown[h.hero] : tex.hero[h.hero];
      act.body.scale.set(0.9 * act.face, 0.9);
      act.body.y = moving && !h.down ? -Math.abs(Math.sin(clock / 85)) * 4 : 0;
      act.body.rotation = h.dashing ? 0.25 * act.face : h.dodging ? ((clock / 40) % (Math.PI * 2)) * act.face : 0;
      const hurt = clock - act.hurtAt < 200;
      act.body.tint = hurt ? 0xff8a8a : 0xffffff;
      act.root.alpha = h.dodging ? 0.6 : 1;
      act.stars.visible = h.down;
      act.stars.position.set(0, -40);
      act.stars.rotation = Math.sin(clock / 120) * 0.4;
      if (act.label) act.label.position.set(0, -66);
      // health bar above, and the "helping up" ring
      act.bar.clear();
      const w = 40;
      act.bar.roundRect(-w / 2, -62, w, 6, 3).fill({ color: 0x000000, alpha: 0.5 });
      act.bar.roundRect(-w / 2, -62, (w * h.hp) / h.maxHp, 6, 3).fill(h.hp / h.maxHp < 0.3 ? 0xff5c5c : 0x7fe07a);
      if (h.down && h.help > 0) act.bar.arc(0, -20, 18, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * h.help) / 2000).stroke({ width: 4, color: 0x7fe07a });
      if (h.special >= 100) act.ring.alpha = 0.6 + 0.4 * Math.sin(clock / 120);
      else act.ring.alpha = 0.7;
      if (act.swing) {
        const age = clock - act.swingAt;
        act.swing.visible = age < 160;
        act.swing.alpha = 1 - age / 160;
        act.swing.scale.set(0.8 + age / 400);
      }
    }
    for (const [id, act] of heroActors) if (!seen.has(id)) act.root.visible = false;

    // Enemies
    const alive = new Set<number>();
    for (const e of latest.enemies) {
      alive.add(e.id);
      let act = enemyActors.get(e.id);
      if (!act) {
        act = makeActor(null, 0);
        act.body.texture = tex.enemy[e.kind];
        act.lastX = e.x;
        act.lastY = e.y;
        act.root.alpha = 0;
        enemyActors.set(e.id, act);
      }
      const ea = a.enemies.find((q) => q.id === e.id) ?? e;
      const eb = b.enemies.find((q) => q.id === e.id) ?? e;
      const x = lerp(ea.x, eb.x);
      const y = lerp(ea.y, eb.y);
      const vx = x - act.lastX;
      if (Math.abs(vx) > 0.003) act.face = vx > 0 ? 1 : -1;
      const moving = Math.hypot(vx, y - act.lastY) > 0.002;
      act.lastX = x;
      act.lastY = y;
      act.root.alpha = Math.min(1, act.root.alpha + dt / 300);
      act.root.position.set(px(x), px(y));
      act.root.zIndex = y * 100;
      const big = e.kind === "umbrellaBoss" || e.kind === "karaokeKing";
      act.body.scale.set((big ? 1.25 : 0.95) * -act.face, big ? 1.25 : 0.95);
      act.body.rotation = e.spinning ? clock / 60 : e.dashing ? 0.3 * act.face : 0;
      act.body.y = moving ? -Math.abs(Math.sin(clock / 70 + e.id)) * 3 : 0;
      act.body.tint = clock - act.hurtAt < 150 ? 0xffffff : e.stunned ? 0xb0b0ff : 0xffffff;
      act.body.alpha = clock - act.hurtAt < 150 ? 0.6 : 1;
      act.stars.visible = e.stunned;
      act.stars.position.set(0, big ? -150 : -64);
      act.stars.rotation = Math.sin(clock / 120) * 0.4;
      act.bar.clear();
      if (e.hp < e.maxHp) {
        const w = big ? 90 : 34;
        const y0 = big ? -148 : -62;
        act.bar.roundRect(-w / 2, y0, w, 5, 2.5).fill({ color: 0x000000, alpha: 0.5 });
        act.bar.roundRect(-w / 2, y0, (w * e.hp) / e.maxHp, 5, 2.5).fill(big ? 0xff5c8a : 0xffb35c);
      }
    }
    for (const [id, act] of enemyActors)
      if (!alive.has(id)) {
        act.root.destroy({ children: true });
        enemyActors.delete(id);
      }

    // Thrown things: pebbles, slippers, planes, balloons, sound waves
    shots.begin();
    for (const s of latest.shots) {
      const sa = a.shots.find((q) => q.id === s.id) ?? s;
      const sb = b.shots.find((q) => q.id === s.id) ?? s;
      const sp = shots.next(tex.shot[s.kind]);
      sp.position.set(px(lerp(sa.x, sb.x)), px(lerp(sa.y, sb.y)) - (s.kind === "wave" ? 0 : 16));
      if (s.kind === "wave") sp.scale.set(((s.r ?? 1) * TILE * 2) / 100);
      else if (s.kind === "slipper") sp.rotation = clock / 50;
      else if (s.kind === "plane") sp.rotation = Math.atan2(sb.y - sa.y, sb.x - sa.x);
      else if (s.kind === "balloon") sp.y -= Math.sin(clock / 100) * 6;
    }
    shots.end();

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt / 1000;
      if (p.life <= 0) {
        p.s.destroy();
        particles.splice(i, 1);
        continue;
      }
      p.s.x += (p.vx * dt) / 1000;
      p.s.y += (p.vy * dt) / 1000;
      p.vy += (p.gravity * dt) / 1000;
      p.s.rotation += (p.spin * dt) / 1000;
      p.s.alpha = Math.min(1, (p.life / p.max) * 2);
      if (p.grow) p.s.scale.set(p.s.scale.x + (p.grow * dt) / 1000);
    }

    // Screen shake
    if (shake > 0.1) {
      world.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      shake *= 0.85;
    } else world.position.set(0, 0);
  }
  app.ticker.add(frame);

  return {
    push,
    destroy() {
      app.ticker.remove(frame);
      tex.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
