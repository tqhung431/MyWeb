// Stage 23 · Ngõ Pháo: draws the alley with PixiJS (WebGL), at the screen's own rate (60, 90, 120 frames a second).
//
// The server sends the game 20 times a second. Drawing only those would look jerky, so:
//   - other players are drawn 100 ms "in the past", smoothly between the two updates around that moment;
//   - YOUR character moves at once with the same walking code as the server (alley-move.ts, "prediction")
//     and is gently corrected if the server disagrees (it's the referee);
//   - firecrackers pulse, sparks flicker, crates burst into splinters: little particles live only here.

import { Application, Container, Graphics, Sprite, Text, Texture, type Ticker } from "pixi.js";
import type { AlleyEvent, AlleyTick } from "@/lib/api/arena";
import { DX, DY, H, speedOf, W, walkFor, type Dir } from "./alley-move";
import { makeTextures, PLAYER_COLORS, TILE, type AlleyTextures } from "./art";

export type RendererOptions = {
  myId: string | null;
  serverNow: () => number;
  /** The direction you're pressing right now */
  myDir: () => Dir;
  onEvent?: (e: AlleyEvent) => void;
  onFps?: (fps: number) => void;
};
export type AlleyRenderer = { push: (view: AlleyTick) => void; destroy: () => void };

const DELAY = 100; // ms: how far in the past other players are drawn
const ringOf = (tx: number, ty: number) => Math.min(tx, ty, W - 1 - tx, H - 1 - ty);

type Particle = { s: Sprite; vx: number; vy: number; life: number; max: number; spin: number; grow: number };

export async function createAlleyRenderer(host: HTMLElement, opts: RendererOptions): Promise<AlleyRenderer> {
  const app = new Application();
  await app.init({
    width: W * TILE,
    height: H * TILE,
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    preference: "webgl",
  });
  app.ticker.maxFPS = 0; // as fast as the screen refreshes
  const canvas = app.canvas;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.display = "block";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const world = new Container();
  app.stage.addChild(world);
  const floorLayer = new Container();
  const tileLayer = new Container();
  const itemLayer = new Container();
  const warnLayer = new Graphics();
  const bombLayer = new Container();
  const sparkLayer = new Container();
  sparkLayer.blendMode = "add";
  const actorLayer = new Container();
  actorLayer.sortableChildren = true;
  const fxLayer = new Container();
  world.addChild(floorLayer, warnLayer, tileLayer, itemLayer, bombLayer, actorLayer, sparkLayer, fxLayer);

  let tex: AlleyTextures | null = null;
  let map = "";
  let tiles = "";
  const tileSprites: Sprite[] = [];
  const snaps: AlleyTick[] = [];
  let shake = 0;
  const me = { x: 0, y: 0, ready: false, facing: 2 as Dir };

  // Small textures for particles
  const dot = (color: number, r: number, soft = false) => {
    const g = new Graphics();
    if (soft) for (let i = 4; i >= 1; i--) g.circle(r, r, (r * i) / 4).fill({ color, alpha: 0.25 });
    else g.circle(r, r, r).fill(color);
    const t = app.renderer.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    return t;
  };
  const sparkDot = dot(0xffd27a, 4);
  const smoke = dot(0xcfc6d6, 14, true);
  const splinter = (() => {
    const g = new Graphics().roundRect(0, 0, 10, 3, 1.5).fill(0xd9b06a);
    const t = app.renderer.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    return t;
  })();
  const confetti = [0xf2c94c, 0xe0453a, 0x2fb38a, 0x8a5ce6].map((c) => dot(c, 3));
  const particles: Particle[] = [];
  const spawn = (texture: Texture, x: number, y: number, n: number, speed: number, life: number, opts2: { grow?: number; spin?: boolean; up?: number; tint?: number } = {}) => {
    for (let i = 0; i < n && particles.length < 400; i++) {
      const s = new Sprite(texture);
      s.anchor.set(0.5);
      s.position.set(x, y);
      if (opts2.tint) s.tint = opts2.tint;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      fxLayer.addChild(s);
      particles.push({ s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts2.up ?? 0), life: life * (0.7 + Math.random() * 0.5), max: life, spin: opts2.spin ? (Math.random() - 0.5) * 12 : 0, grow: opts2.grow ?? 0 });
    }
  };

  // --- the board -------------------------------------------------------------------------------

  function setMap(id: string) {
    map = id;
    tex?.destroy();
    tex = makeTextures(app.renderer, id);
    floorLayer.removeChildren().forEach((c) => c.destroy());
    for (let ty = 0; ty < H; ty++)
      for (let tx = 0; tx < W; tx++) {
        const s = new Sprite(tex.floor[(tx * 7 + ty * 13 + (tx ^ ty)) % tex.floor.length]);
        s.position.set(tx * TILE, ty * TILE);
        floorLayer.addChild(s);
      }
    tileLayer.removeChildren().forEach((c) => c.destroy());
    tileSprites.length = 0;
    for (let i = 0; i < W * H; i++) {
      const s = new Sprite(Texture.EMPTY);
      s.anchor.set(0.5, 0.5);
      s.position.set((i % W) * TILE + TILE / 2, Math.floor(i / W) * TILE + TILE / 2);
      tileLayer.addChild(s);
      tileSprites.push(s);
    }
    tiles = "";
  }

  function setTiles(next: string) {
    if (!tex) return;
    for (let i = 0; i < next.length; i++) {
      if (next[i] === tiles[i]) continue;
      const s = tileSprites[i];
      const c = next[i];
      s.texture = c === "#" ? tex.wall : c === "c" ? tex.crate : c === "L" ? tex.lantern : Texture.EMPTY;
      s.scale.set(c === "L" && tiles.length ? 0.2 : 1); // lanterns drop in with a little bounce
    }
    tiles = next;
  }

  // Sprite pools: reuse sprites instead of making new ones every frame
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
        used++;
        return s;
      },
      end: () => {
        for (let i = used; i < list.length; i++) list[i].visible = false;
      },
    };
  };
  const items = pool(itemLayer);
  const bombs = pool(bombLayer);
  const fuses = pool(bombLayer);
  const sparks = pool(sparkLayer);

  type Actor = { root: Container; body: Sprite; shield: Graphics; label: Text; stars: Text; facing: Dir; lastX: number; lastY: number };
  const actors = new Map<string, Actor>();
  const actorFor = (id: string, name: string, color: number) => {
    let a = actors.get(id);
    if (!a) {
      const root = new Container();
      const body = new Sprite(Texture.EMPTY);
      body.anchor.set(0.5, 0.82);
      const shield = new Graphics().circle(0, -14, 26).fill({ color: 0x7fe0bd, alpha: 0.18 }).circle(0, -14, 26).stroke({ width: 2, color: 0xb8ffe6, alpha: 0.8 });
      const label = new Text({ text: name, style: { fontFamily: "system-ui, sans-serif", fontSize: 11, fontWeight: "700", fill: 0xffffff, stroke: { color: PLAYER_COLORS[color % 4].dark, width: 3 } } });
      label.anchor.set(0.5, 1);
      label.position.set(0, -44);
      const stars = new Text({ text: "✦ ✧ ✦", style: { fontSize: 12, fill: 0xffe08a } });
      stars.anchor.set(0.5);
      stars.position.set(0, -46);
      root.addChild(shield, body, label, stars);
      actorLayer.addChild(root);
      a = { root, body, shield, label, stars, facing: 3, lastX: 0, lastY: 0 };
      actors.set(id, a);
    }
    return a;
  };

  const lion = new Container();
  const lionParts: Sprite[] = [];
  actorLayer.addChild(lion);

  // --- updates from the server -----------------------------------------------------------------

  function push(view: AlleyTick) {
    if (view.map !== map) setMap(view.map);
    if (view.tiles !== tiles) setTiles(view.tiles);
    const last = snaps.at(-1);
    if (last && view.round !== last.round) {
      snaps.length = 0; // a new round: everyone is back in their corner, don't slide them there
      me.ready = false;
    }
    snaps.push(view);
    if (snaps.length > 12) snaps.shift();
    for (const e of view.events) {
      opts.onEvent?.(e);
      const cx = (x: number) => x * TILE + TILE / 2;
      if (e.t === "pop") {
        shake = Math.max(shake, e.tiny ? 2 : 7);
        spawn(sparkDot, cx(e.tx), cx(e.ty), e.tiny ? 8 : 18, 220, 0.5, { spin: false });
        spawn(smoke, cx(e.tx), cx(e.ty), e.tiny ? 2 : 4, 40, 0.8, { grow: 1.2, up: 20 });
      } else if (e.t === "crate") {
        spawn(splinter, cx(e.tx), cx(e.ty), 10, 160, 0.6, { spin: true });
        spawn(smoke, cx(e.tx), cx(e.ty), 2, 30, 0.6, { grow: 0.8, tint: 0xd9b06a });
      } else if (e.t === "power") {
        for (const c of confetti) spawn(c, cx(e.tx), cx(e.ty), 4, 120, 0.7, { up: 60 });
      } else if (e.t === "out") {
        const p = view.players.find((x) => x.id === e.id);
        if (p) spawn(smoke, p.x * TILE, p.y * TILE, 6, 50, 0.9, { grow: 1.4, up: 30 });
      } else if (e.t === "ring") shake = Math.max(shake, 4);
    }
  }

  // --- every frame -----------------------------------------------------------------------------

  let fpsAt = 0;
  function frame(ticker: Ticker) {
    const dt = Math.min(ticker.deltaMS, 100);
    const latest = snaps.at(-1);
    if (!latest || !tex) return;
    const now = opts.serverNow();
    const renderT = now - DELAY;
    // the two updates around renderT
    let a = snaps[0];
    let b = snaps[0];
    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].t <= renderT) a = snaps[i];
      if (snaps[i].t >= renderT) {
        b = snaps[i];
        break;
      }
      b = snaps[i];
    }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (renderT - a.t) / (b.t - a.t))) : 1;
    const lerp = (x: number, y: number) => x + (y - x) * k;

    // Lanterns land with a bounce
    for (const s of tileSprites) if (s.scale.x < 1) s.scale.set(Math.min(1, s.scale.x + dt / 180));

    // Warning: the next ring of lanterns flashes red
    warnLayer.clear();
    if (latest.ringAt !== null && latest.ringAt - now < 2000 && latest.phase === "playing") {
      const alpha = 0.25 + 0.2 * Math.sin(now / 80);
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) if (ringOf(tx, ty) === latest.rings) warnLayer.rect(tx * TILE, ty * TILE, TILE, TILE).fill({ color: 0xff3b2f, alpha });
    }

    // Power-ups bob up and down
    items.begin();
    for (const [i, kind] of latest.items) {
      const s = items.next(tex.power[kind]);
      s.position.set((i % W) * TILE + TILE / 2, Math.floor(i / W) * TILE + TILE / 2 + Math.sin(now / 250 + i) * 3);
    }
    items.end();

    // Firecrackers pulse faster as they're about to pop; a spark fizzes on the fuse
    bombs.begin();
    fuses.begin();
    for (const bomb of latest.bombs) {
      const prev = a.bombs.find((x) => x.id === bomb.id);
      const posOf = (x: typeof bomb) => [x.tx + 0.5 + DX[x.slide] * x.progress, x.ty + 0.5 + DY[x.slide] * x.progress];
      const [bx, by] = posOf(bomb);
      const [px, py] = prev ? posOf(prev) : [bx, by];
      const x = (prev && Math.hypot(bx - px, by - py) < 2 ? px + (bx - px) * k : bx) * TILE;
      const y = (prev && Math.hypot(bx - px, by - py) < 2 ? py + (by - py) * k : by) * TILE;
      const left = Math.max(0, bomb.left - (now - latest.t));
      const rate = left < 800 ? 40 : left < 1600 ? 90 : 160;
      const pulse = 1 + 0.08 * Math.sin(now / rate);
      const s = bombs.next(bomb.tiny ? tex.tiny : tex.bomb);
      s.position.set(x, y);
      s.scale.set(pulse);
      const f = fuses.next(tex.fuse);
      f.position.set(x + 2 * pulse, y - (bomb.tiny ? 10 : 18) * pulse);
      f.scale.set(0.6 + Math.random() * 0.5);
      f.rotation = Math.random() * Math.PI;
    }
    bombs.end();
    fuses.end();

    // Sparks flicker
    sparks.begin();
    for (const [tx, ty, tiny] of latest.sparks) {
      const s = sparks.next(tiny ? tex.tinySpark : tex.spark);
      s.position.set(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
      s.scale.set(1 + Math.random() * 0.15);
      s.alpha = 0.8 + Math.random() * 0.2;
      s.rotation = Math.random() * 0.3;
    }
    sparks.end();

    // People
    const seen = new Set<string>();
    for (const p of latest.players) {
      seen.add(p.id);
      const act = actorFor(p.id, p.name, p.color);
      let x: number;
      let y: number;
      const mine = p.id === opts.myId;
      if (mine && (p.alive || p.ghost) && latest.phase === "playing" && !p.stunned) {
        // Prediction: move now, with the same rules as the server
        if (!me.ready) Object.assign(me, { x: p.x, y: p.y, ready: true });
        const dir = opts.myDir();
        const r = walkFor(me.x, me.y, dir, ((p.ghost ? 2.6 : speedOf(p.boots)) * dt) / 1000, {
          tiles: latest.tiles,
          ghost: p.ghost,
          bombBlocks: (bx, by) => latest.bombs.some((bb) => bb.tx === bx && bb.ty === by && !bb.mine.includes(p.id)),
        });
        me.x = r.x;
        me.y = r.y;
        const err = Math.hypot(me.x - p.x, me.y - p.y);
        if (err > 0.7) Object.assign(me, { x: p.x, y: p.y }); // pushed by the lion, or way off: trust the server
        else if (dir === 0 && err > 0.02) Object.assign(me, { x: me.x + (p.x - me.x) * 0.2, y: me.y + (p.y - me.y) * 0.2 });
        if (dir) act.facing = dir;
        x = me.x;
        y = me.y;
      } else {
        const pa = a.players.find((q) => q.id === p.id) ?? p;
        const pb = b.players.find((q) => q.id === p.id) ?? p;
        const far = Math.hypot(pa.x - pb.x, pa.y - pb.y) > 1.5;
        x = far ? pb.x : lerp(pa.x, pb.x);
        y = far ? pb.y : lerp(pa.y, pb.y);
        if (mine) Object.assign(me, { x, y, ready: true });
        const vx = x - act.lastX;
        const vy = y - act.lastY;
        if (Math.hypot(vx, vy) > 0.004) act.facing = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 4) : vy > 0 ? 3 : 1;
      }
      const moving = Math.hypot(x - act.lastX, y - act.lastY) > 0.002;
      act.lastX = x;
      act.lastY = y;
      const visible = p.alive || p.ghost;
      act.root.visible = visible;
      if (!visible) continue;
      act.body.texture = tex.character(p.color, p.hat, act.facing, p.ghost ? "ghost" : p.stunned ? "dazed" : "");
      const bob = p.ghost ? Math.sin(now / 300 + p.color) * 4 - 6 : moving ? -Math.abs(Math.sin(now / 90)) * 3 : 0;
      act.root.position.set(x * TILE, y * TILE + 14);
      act.body.y = bob;
      act.body.scale.set(moving && !p.ghost ? 1 + Math.sin(now / 45) * 0.02 : 1, moving && !p.ghost ? 1 - Math.sin(now / 45) * 0.02 : 1);
      act.root.alpha = p.ghost ? 0.7 : p.blink ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1;
      act.root.zIndex = p.ghost ? 10_000 : y * 100;
      act.shield.visible = p.shield;
      act.shield.alpha = 0.7 + Math.sin(now / 200) * 0.3;
      act.stars.visible = p.stunned;
      act.stars.rotation = Math.sin(now / 120) * 0.3;
      act.label.visible = !mine;
    }
    for (const [id, act] of actors) if (!seen.has(id)) act.root.visible = false;

    // The lion dance: a big head and three bouncing pieces of cloth behind it
    const lionNow = latest.lion;
    lion.visible = !!lionNow;
    if (lionNow) {
      if (!lionParts.length) {
        for (const t of [...tex.cloth].reverse()) {
          const s = new Sprite(t);
          s.anchor.set(0.5, 0.7);
          lion.addChild(s);
          lionParts.push(s);
        }
        const head = new Sprite(tex.lion);
        head.anchor.set(0.5, 0.75);
        lion.addChild(head);
        lionParts.push(head);
      }
      const pl = a.lion ?? lionNow;
      const lx = (Math.abs(pl.x - lionNow.x) < 2 ? lerp(pl.x, b.lion?.x ?? lionNow.x) : lionNow.x) * TILE;
      const ly = lionNow.row * TILE + TILE;
      lion.zIndex = ly * 100 + 50;
      lionParts.forEach((s, i) => {
        const back = (lionParts.length - 1 - i) * 30;
        s.position.set(lx - lionNow.dir * back, ly + Math.sin(now / 110 + i) * 5 - 6);
        s.scale.x = lionNow.dir;
        s.rotation = Math.sin(now / 150 + i) * 0.08;
      });
    }

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
      p.vy += (280 * dt) / 1000 * (p.grow ? -0.2 : 1);
      p.s.rotation += (p.spin * dt) / 1000;
      p.s.alpha = Math.min(1, (p.life / p.max) * 1.5);
      if (p.grow) p.s.scale.set(1 + (1 - p.life / p.max) * p.grow);
    }

    // Screen shake when something pops
    shake = Math.max(0, shake - dt / 40);
    world.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    if (opts.onFps && now - fpsAt > 1000) {
      fpsAt = now;
      opts.onFps(Math.round(app.ticker.FPS));
    }
  }
  app.ticker.add(frame);

  return {
    push,
    destroy() {
      app.ticker.remove(frame);
      tex?.destroy();
      app.destroy(true, { children: true, texture: true });
    },
  };
}
