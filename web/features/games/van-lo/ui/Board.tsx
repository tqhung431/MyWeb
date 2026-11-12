"use client";

// The map on a <canvas>. React draws the menus; this draws the world, up to 60 times a second.
//
// Layers, bottom to top:
//   1. the painted floor (painted once into an offscreen canvas and reused)
//   2. things: herbs, chests, urns, shrines, the merchant, decorations
//   3. the mist: a tiny canvas with one pixel per tile, stretched with smoothing, so its edges are soft
//   4. characters: enemies, your soldiers, and you (an animated sprite: idle, walk, attack, hurt)
//   5. particles: dust, sparks, shards, the realm's air
//   6. lighting: in dark mode the floor is dark except around you and the torches
//   7. effects of the last turn: numbers, sword strokes, lightning
//
// Stage 18: "light effects" mode for older phones: sharp-pixel off (1×), few particles, no lighting, 30 fps.

import { useEffect, useRef } from "react";
import type { Pos } from "../engine/grid";
import { realmInfo, type PathId } from "../logic/data";
import type { Run } from "../logic/types";
import type { Fx } from "../logic/world";
import { ANIM_MS, DARK, drawAlly, drawAnim, drawEnemy, drawThing, LIGHT, paintFloor, type Anim } from "./draw";
import { AMBIENT, Particles } from "./particles";
import { flashOf, FRAMES, heroSprite, LIGHTS, type Pose } from "./sprites";

type Props = {
  run: Run;
  path: PathId;
  major: number;
  seen: Set<number>; // visible now
  dark: boolean;
  lite: boolean;
  fx: { id: number; list: Fx[] } | null;
  targets: Pos[] | null;
  onTap: (p: Pos) => void;
  onSlow?: () => void; // called once if frames are too slow (so the screen can offer light effects)
  className?: string;
};

const ATTACK_MS = 240;
const HURT_MS = 260;

export function Board({ run, path, major, seen, dark, lite, fx, targets, onTap, onSlow, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ run, seen, dark, targets, path, major, lite, onSlow });
  props.current = { run, seen, dark, targets, path, major, lite, onSlow };
  const anims = useRef<Anim[]>([]);
  const shown = useRef<{ player: Pos | null; enemies: Map<string, Pos> }>({ player: null, enemies: new Map() });
  const view = useRef({ tile: 32, cam: { x: 0, y: 0 }, w: 0, h: 0 });
  const texture = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  const fog = useRef<{ seen: Set<number> | null; floor: string; canvas: HTMLCanvasElement | null }>({ seen: null, floor: "", canvas: null });
  const hero = useRef({ facing: 1 as 1 | -1, attack: 0, hurt: 0, lunge: { x: 0, y: 0 }, last: null as Pos | null });
  const flashes = useRef(new Map<string, number>());
  const shake = useRef(0);
  const parts = useRef(new Particles(lite ? 90 : 420));
  const lightCanvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    parts.current.cap = lite ? 90 : 420;
    texture.current = null;
    window.dispatchEvent(new Event("resize")); // re-fit the canvas at the new sharpness
  }, [lite]);

  // New effects from the last turn
  useEffect(() => {
    if (!fx) return;
    const now = performance.now();
    const add = (a: Anim) => anims.current.push(a);
    const ink = dark ? DARK : LIGHT;
    const P = parts.current;
    const r = props.current.run;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const kick = (n: number) => {
      if (!reduced) shake.current = Math.max(shake.current, n);
    };
    for (const f of fx.list) {
      if (f.type === "hit") {
        add({
          kind: "number",
          at: f.at,
          text: String(f.amount),
          color: f.onPlayer ? "#d23b2e" : f.crit ? "#e0782f" : ink.ink,
          big: f.crit,
          start: now,
        });
        P.burst(f.at.x + 0.5, f.at.y + 0.4, f.crit ? 14 : 7, {
          color: f.onPlayer ? ["#d23b2e", "#ff8a7a"] : ["#ffd27a", "#fff4c8", f.crit ? "#e0782f" : "#ffffff"],
          speed: f.crit ? 4.5 : 3,
          shape: "spark",
          life: 320,
          size: 0.03,
        });
        if (f.onPlayer) {
          hero.current.hurt = now;
          kick(7);
        } else {
          const e = r.floor.enemies.find((x) => x.pos.x === f.at.x && x.pos.y === f.at.y);
          if (e) flashes.current.set(e.uid, now + 130);
          if (f.crit) kick(4);
        }
      } else if (f.type === "miss") add({ kind: "number", at: f.at, text: "né", color: ink.jade, start: now });
      else if (f.type === "slash") {
        add({ kind: "slash", from: f.from, to: f.to, color: f.color ?? ink.ink, start: now });
        if (f.from.x === r.pos.x && f.from.y === r.pos.y) {
          const h = hero.current;
          h.attack = now;
          const dx = Math.sign(f.to.x - f.from.x);
          const dy = Math.sign(f.to.y - f.from.y);
          if (dx) h.facing = dx > 0 ? 1 : -1;
          h.lunge = { x: dx, y: dy };
        }
      } else if (f.type === "bolt") {
        add({ kind: "bolt", at: f.at, start: now });
        P.burst(f.at.x + 0.5, f.at.y + 0.5, 16, { color: ["#fff2a8", "#ffd84a"], speed: 5, shape: "spark", life: 380 });
        kick(9);
      } else if (f.type === "area") {
        add({ kind: "ring", at: f.at, r: f.r, color: f.color ?? ink.gold, start: now });
        P.burst(f.at.x + 0.5, f.at.y + 0.5, 10 + f.r * 6, { color: f.color ?? ink.gold, speed: 1.6 + f.r * 1.4, life: 500, size: 0.04 });
      } else if (f.type === "heal") {
        add({ kind: "number", at: f.at, text: `+${f.amount}`, color: f.qi ? "#3f6f9a" : "#3f7d4b", start: now });
        for (let i = 0; i < 8; i++)
          P.add({
            x: f.at.x + 0.2 + Math.random() * 0.6,
            y: f.at.y + 0.5 + Math.random() * 0.3,
            vx: 0,
            vy: -0.6 - Math.random() * 0.5,
            gravity: 0,
            life: 700 + Math.random() * 300,
            size: 0.035,
            color: f.qi ? "#7ab8e6" : "#7fd08e",
            shape: "glow",
          });
      } else if (f.type === "die") {
        add({ kind: "splash", at: f.at, start: now + 80 });
        P.burst(f.at.x + 0.5, f.at.y + 0.5, 18, { color: [ink.ink, ink.inkSoft, ink.seal], speed: 2.4, gravity: 3, up: 1, life: 650, size: 0.05 });
      } else if (f.type === "summon") {
        add({ kind: "ring", at: f.at, r: 0, color: "#a8231b", start: now });
        P.burst(f.at.x + 0.5, f.at.y + 0.6, 12, { color: ["#a8231b", "#e0645a"], speed: 1.2, up: 1.2, life: 600 });
      } else if (f.type === "break") {
        const wood = f.kind === "crate";
        P.burst(f.at.x + 0.5, f.at.y + 0.5, 16, {
          color: wood ? ["#8a5a2b", "#b07a42", "#5a3a1c"] : ["#b0643a", "#d08a5a", "#7a3e22"],
          speed: 3,
          up: 2,
          gravity: 9,
          shape: "shard",
          life: 650,
          size: 0.07,
        });
        P.burst(f.at.x + 0.5, f.at.y + 0.75, 6, { color: "rgba(150,140,120,0.6)", speed: 0.8, life: 500, size: 0.08 });
        kick(3);
      } else if (f.type === "bless") {
        add({ kind: "ring", at: f.at, r: 1, color: "#e8c35a", start: now });
        for (let i = 0; i < 22; i++)
          P.add({
            x: f.at.x + Math.random(),
            y: f.at.y + 0.3 + Math.random() * 0.7,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -0.8 - Math.random() * 0.9,
            gravity: 0,
            life: 900 + Math.random() * 600,
            size: 0.035,
            color: "#ffd84a",
            shape: "glow",
          });
      } else if (f.type === "text")
        add({
          kind: "number",
          at: f.at,
          text: f.text,
          color: f.tone === "bad" ? "#d23b2e" : f.tone === "loot" ? ink.gold : f.tone === "good" ? ink.jade : ink.ink,
          start: now + 60,
        });
    }
  }, [fx, dark]);

  // Size the canvas to its box (sharp on high-density screens, unless light effects are on)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = props.current.lite ? 1 : Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      const across = box.width < 500 ? 11 : box.width < 900 ? 15 : 19;
      view.current = { ...view.current, tile: Math.max(26, Math.min(48, Math.floor(box.width / across))), w: box.width, h: box.height };
      texture.current = null;
      lightCanvas.current = null;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  // The drawing loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let frame = 0;
    let last = performance.now();
    let lastDrawn = 0;
    let ambientDebt = 0;
    const slow = { frames: 0, time: 0, told: false };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const { run: r, seen: vis, dark: isDark, targets: tg, path: who, major, lite: isLite } = props.current;
      if (isLite && now - lastDrawn < 30) return; // 30 frames a second is plenty on an old phone
      lastDrawn = now;
      const dt = Math.min(64, now - last);
      last = now;
      const ink = isDark ? DARK : LIGHT;
      const { tile, w, h } = view.current;
      if (!w) return;
      const dpr = canvas.width / w;
      const f = r.floor;
      const tribulation = r.kind === "tribulation";
      const P = parts.current;

      // Watch the frame rate for the first few seconds: if it's poor, offer light effects
      if (!slow.told && !isLite && slow.frames < 180) {
        slow.frames++;
        slow.time += dt;
        if (slow.frames === 180 && slow.time / slow.frames > 30) {
          slow.told = true;
          props.current.onSlow?.();
        }
      }

      // Glide the player and enemies towards their real tiles
      const ease = 1 - Math.exp(-dt / 55);
      const sp = shown.current;
      const H = hero.current;
      if (!sp.player || Math.abs(sp.player.x - r.pos.x) + Math.abs(sp.player.y - r.pos.y) > 6) sp.player = { ...r.pos };
      if (H.last && (H.last.x !== r.pos.x || H.last.y !== r.pos.y)) {
        const dx = r.pos.x - H.last.x;
        if (dx) H.facing = dx > 0 ? 1 : -1;
        if (Math.abs(dx) + Math.abs(r.pos.y - H.last.y) <= 2) {
          // a puff of dust behind your feet
          P.burst(H.last.x + 0.5, H.last.y + 0.85, isLite ? 2 : 5, {
            color: isDark ? "rgba(200,190,170,0.5)" : "rgba(120,100,80,0.45)",
            speed: 0.6,
            up: 0.3,
            life: 380,
            size: 0.05,
          });
        }
      }
      H.last = { ...r.pos };
      sp.player = { x: sp.player.x + (r.pos.x - sp.player.x) * ease, y: sp.player.y + (r.pos.y - sp.player.y) * ease };
      const alive = new Set<string>();
      for (const e of [...f.enemies, ...(f.allies ?? [])]) {
        alive.add(e.uid);
        const old = sp.enemies.get(e.uid);
        if (!old || Math.abs(old.x - e.pos.x) + Math.abs(old.y - e.pos.y) > 4) sp.enemies.set(e.uid, { ...e.pos });
        else sp.enemies.set(e.uid, { x: old.x + (e.pos.x - old.x) * ease, y: old.y + (e.pos.y - old.y) * ease });
      }
      for (const id of [...sp.enemies.keys()]) if (!alive.has(id)) sp.enemies.delete(id);

      // Camera: follow the player, stay inside the map (or centre a small map), plus a little shake
      const across = w / tile;
      const down = h / tile;
      let camX = f.w <= across ? (f.w - across) / 2 : Math.max(0, Math.min(f.w - across, sp.player.x + 0.5 - across / 2));
      let camY = f.h <= down ? (f.h - down) / 2 : Math.max(0, Math.min(f.h - down, sp.player.y + 0.5 - down / 2));
      if (shake.current > 0.2) {
        camX += ((Math.random() - 0.5) * shake.current) / tile;
        camY += ((Math.random() - 0.5) * shake.current) / tile;
        shake.current *= Math.exp(-dt / 70);
      } else shake.current = 0;
      view.current.cam = { x: camX, y: camY };
      const toScreen = (p: Pos) => ({ x: (p.x - camX) * tile + tile / 2, y: (p.y - camY) * tile + tile / 2 });

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.imageSmoothingEnabled = true;
      const paper = realmInfo(r.realm).paper[isDark ? "dark" : "light"];
      g.fillStyle = tribulation ? (isDark ? "#0f0e14" : "#cfc9c0") : paper;
      g.fillRect(0, 0, w, h);

      const key = `${f.tiles}|${f.depth}|${tile}|${isDark}|${dpr}|${r.realm}`;
      if (texture.current?.key !== key) texture.current = { key, canvas: paintFloor(f, tile, ink, dpr, tribulation, paper) };
      g.drawImage(texture.current.canvas, -camX * tile, -camY * tile, f.w * tile, f.h * tile);

      const idx = (x: number, y: number) => y * f.w + x;
      const onScreen = (p: Pos) => p.x >= camX - 1 && p.y >= camY - 1 && p.x <= camX + across + 1 && p.y <= camY + down + 1;

      // Things you've seen (remembered ones are drawn under the mist)
      for (const th of f.things) {
        if (f.seen[idx(th.pos.x, th.pos.y)] !== "1" || !onScreen(th.pos)) continue;
        const p = toScreen(th.pos);
        drawThing(g, th, p.x, p.y, tile, ink);
      }

      // Tribulation: where the lightning will strike next turn
      if (r.strikes) {
        const pulse = 0.5 + Math.sin(now / 120) * 0.25;
        for (const s of r.strikes) {
          const p = toScreen(s);
          g.fillStyle = `rgba(255,214,74,${0.18 + pulse * 0.2})`;
          g.strokeStyle = `rgba(214,160,30,${0.5 + pulse * 0.3})`;
          g.lineWidth = 2;
          g.beginPath();
          g.arc(p.x, p.y, tile * 0.38, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          g.font = `${tile * 0.42}px system-ui, sans-serif`;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText("⚡", p.x, p.y + 1);
        }
      }

      // Mist: one pixel per tile (clear = seen now, half = remembered, solid = never seen), stretched softly.
      // Rebuilt only when what you see changes, not every frame.
      if (!tribulation) {
        const F = fog.current;
        if (F.seen !== vis || F.floor !== f.seen || !F.canvas || F.canvas.width !== f.w) {
          const c = F.canvas && F.canvas.width === f.w && F.canvas.height === f.h ? F.canvas : document.createElement("canvas");
          c.width = f.w;
          c.height = f.h;
          const fg = c.getContext("2d")!;
          const img = fg.createImageData(f.w, f.h);
          const n = parseInt(paper.slice(1), 16);
          for (let i = 0; i < f.w * f.h; i++) {
            img.data[i * 4] = n >> 16;
            img.data[i * 4 + 1] = (n >> 8) & 255;
            img.data[i * 4 + 2] = n & 255;
            img.data[i * 4 + 3] = vis.has(i) ? 0 : f.seen[i] === "1" ? 128 : 255;
          }
          fg.putImageData(img, 0, 0);
          fog.current = { seen: vis, floor: f.seen, canvas: c };
        }
        g.drawImage(fog.current.canvas!, -camX * tile, -camY * tile, f.w * tile, f.h * tile);
      }

      // Valid targets while choosing where to aim
      if (tg) {
        g.fillStyle = "rgba(63,125,106,0.22)";
        g.strokeStyle = "rgba(63,125,106,0.8)";
        g.lineWidth = 1.5;
        for (const t of tg) {
          const p = toScreen(t);
          g.fillRect(p.x - tile / 2 + 2, p.y - tile / 2 + 2, tile - 4, tile - 4);
          g.strokeRect(p.x - tile / 2 + 2, p.y - tile / 2 + 2, tile - 4, tile - 4);
        }
      }

      // Enemies you can see (they shake and flash white when hit), your soldiers, then you
      for (const e of f.enemies) {
        const ghostInWall = f.tiles[idx(e.pos.x, e.pos.y)] === "#";
        if (!vis.has(idx(e.pos.x, e.pos.y)) && !(ghostInWall && Math.max(Math.abs(e.pos.x - r.pos.x), Math.abs(e.pos.y - r.pos.y)) <= 1)) continue;
        const p = toScreen(sp.enemies.get(e.uid) ?? e.pos);
        const flash = (flashes.current.get(e.uid) ?? 0) > now;
        if (flash) {
          p.x += (Math.random() - 0.5) * tile * 0.12;
          if ("filter" in g) g.filter = "brightness(2.2) saturate(0.4)";
        }
        drawEnemy(g, e, p.x, p.y, tile, ink);
        if (flash && "filter" in g) g.filter = "none";
      }
      for (const a of f.allies ?? []) {
        const q = toScreen(sp.enemies.get(a.uid) ?? a.pos);
        drawAlly(g, a, q.x, q.y, tile, ink);
      }

      const me = toScreen(sp.player);
      const moving = Math.abs(sp.player.x - r.pos.x) + Math.abs(sp.player.y - r.pos.y) > 0.04;
      const sinceAttack = now - H.attack;
      const sinceHurt = now - H.hurt;
      let pose: Pose = "idle";
      let poseFrame = Math.floor(now / 520);
      if (sinceAttack < ATTACK_MS) {
        pose = "attack";
        poseFrame = Math.min(2, Math.floor((sinceAttack / ATTACK_MS) * 3));
        const k = Math.sin((sinceAttack / ATTACK_MS) * Math.PI) * tile * 0.22;
        me.x += H.lunge.x * k;
        me.y += H.lunge.y * k;
      } else if (sinceHurt < HURT_MS) pose = "hurt";
      else if (moving) {
        pose = "walk";
        poseFrame = Math.floor(now / 85);
      }
      const size = Math.round(tile * dpr);
      const sprite = heroSprite(who, major, pose, poseFrame, H.facing, isDark, size);
      const sx = me.x - tile;
      const sy = me.y - tile * 1.08;
      if (r.status.some((s) => s.kind === "echo")) {
        g.globalAlpha = 0.3;
        g.drawImage(sprite, sx - H.facing * tile * 0.22, sy, tile * 2, tile * 2);
        g.globalAlpha = 1;
      }
      g.drawImage(sprite, sx, sy, tile * 2, tile * 2);
      if (sinceHurt < HURT_MS) {
        g.globalAlpha = 0.75 * (1 - sinceHurt / HURT_MS);
        g.drawImage(flashOf(sprite, `${who}:${major}:${pose}:${poseFrame % FRAMES[pose]}:${H.facing}:${isDark}:${size}`), sx, sy, tile * 2, tile * 2);
        g.globalAlpha = 1;
      }
      if (r.status.some((s) => s.kind === "shield" || s.kind === "block")) {
        g.strokeStyle = `rgba(122,167,199,${0.55 + Math.sin(now / 300) * 0.2})`;
        g.lineWidth = 2;
        g.beginPath();
        g.arc(me.x, me.y, tile * 0.5, 0, Math.PI * 2);
        g.stroke();
      }
      const blessed = r.status.find((s) => s.kind === "bless-atk" || s.kind === "bless-def" || s.kind === "regen");
      if (blessed && !isLite && Math.random() < dt / 260)
        P.add({
          x: sp.player.x + 0.25 + Math.random() * 0.5,
          y: sp.player.y + 0.8,
          vx: 0,
          vy: -0.7,
          gravity: 0,
          life: 800,
          size: 0.03,
          color: blessed.kind === "bless-atk" ? "#ff9a6a" : blessed.kind === "bless-def" ? "#9ac8ff" : "#8fe0a0",
          shape: "glow",
        });

      // The realm's air, and sparks from fires you can see
      if (!isLite && !reduced) {
        const air = AMBIENT[tribulation ? "tribulation" : r.realm];
        ambientDebt += (air.rate * dt) / 1000;
        while (ambientDebt >= 1) {
          ambientDebt--;
          const x = camX + Math.random() * across;
          const y = camY + Math.random() * down;
          const i = idx(Math.floor(x), Math.floor(y));
          if (!tribulation && !vis.has(i)) continue;
          P.add({
            x,
            y,
            vx: (Math.random() - 0.5) * air.drift,
            vy: -air.rise * (0.6 + Math.random() * 0.8),
            gravity: 0,
            life: air.life * (0.6 + Math.random() * 0.6),
            size: air.size * (0.7 + Math.random() * 0.6),
            color: air.color[Math.floor(Math.random() * air.color.length)],
            shape: air.shape,
            spin: Math.random() * 6,
          });
        }
        for (const th of f.things) {
          if (th.kind !== "deco" || (th.deco !== "torch" && th.deco !== "campfire") || !vis.has(idx(th.pos.x, th.pos.y))) continue;
          if (Math.random() < dt / (th.deco === "campfire" ? 160 : 320))
            P.add({
              x: th.pos.x + 0.4 + Math.random() * 0.2,
              y: th.pos.y + (th.deco === "campfire" ? 0.45 : 0.15),
              vx: (Math.random() - 0.5) * 0.3,
              vy: -0.8 - Math.random() * 0.6,
              gravity: 0,
              life: 700,
              size: 0.022,
              color: Math.random() < 0.5 ? "#ffb347" : "#ff7a2f",
              shape: "dot",
            });
        }
      }
      P.update(dt);
      P.draw(g, tile, { x: camX, y: camY });

      // Lighting: dark mode only. The darkness has holes around you and around every light you've found.
      if (isDark && !isLite && !tribulation) {
        let lc = lightCanvas.current;
        if (!lc || lc.width !== canvas.width || lc.height !== canvas.height) {
          lc = lightCanvas.current = document.createElement("canvas");
          lc.width = canvas.width;
          lc.height = canvas.height;
        }
        const L = lc.getContext("2d")!;
        L.setTransform(dpr, 0, 0, dpr, 0, 0);
        L.globalCompositeOperation = "source-over";
        L.clearRect(0, 0, w, h);
        L.fillStyle = "rgba(4,3,8,0.58)";
        L.fillRect(0, 0, w, h);
        L.globalCompositeOperation = "destination-out";
        const hole = (x: number, y: number, radius: number, strength: number) => {
          const grad = L.createRadialGradient(x, y, 0, x, y, radius);
          grad.addColorStop(0, `rgba(0,0,0,${strength})`);
          grad.addColorStop(0.55, `rgba(0,0,0,${strength * 0.7})`);
          grad.addColorStop(1, "rgba(0,0,0,0)");
          L.fillStyle = grad;
          L.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        };
        hole(me.x, me.y, tile * (4.6 + major * 0.3), 1);
        const glows: { x: number; y: number; r: number }[] = [];
        for (const th of f.things) {
          const kind = th.kind === "deco" ? th.deco : th.kind === "shrine" && !th.used ? "shrine" : null;
          const radius = kind ? LIGHTS[kind as keyof typeof LIGHTS] : th.kind === "portal" ? 1.6 : undefined;
          if (!radius || f.seen[idx(th.pos.x, th.pos.y)] !== "1" || !onScreen(th.pos)) continue;
          const p = toScreen(th.pos);
          const flicker = 1 + Math.sin(now / 90 + th.pos.x * 3) * 0.04 + Math.sin(now / 37 + th.pos.y) * 0.03;
          hole(p.x, p.y, tile * radius * flicker, 0.95);
          glows.push({ x: p.x, y: p.y, r: tile * radius * flicker });
        }
        g.drawImage(lc, 0, 0, w, h);
        // A warm tint around fires
        g.globalCompositeOperation = "lighter";
        for (const gl of glows) {
          const grad = g.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, gl.r * 0.8);
          grad.addColorStop(0, "rgba(255,150,60,0.16)");
          grad.addColorStop(1, "rgba(255,150,60,0)");
          g.fillStyle = grad;
          g.fillRect(gl.x - gl.r, gl.y - gl.r, gl.r * 2, gl.r * 2);
        }
        g.globalCompositeOperation = "source-over";
      }

      // Effects
      anims.current = anims.current.filter((a) => drawAnim(g, a, now, tile, toScreen, ink));
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ touchAction: "manipulation" }}
      onPointerUp={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        const { tile, cam } = view.current;
        onTap({ x: Math.floor((e.clientX - box.left) / tile + cam.x), y: Math.floor((e.clientY - box.top) / tile + cam.y) });
      }}
      aria-label="Game map. Use the arrow keys to move, or tap a tile."
      role="img"
    />
  );
}

export const FX_DONE_MS = Math.max(...Object.values(ANIM_MS));

// Light effects: on by default for phones with few cores or little memory, or if you asked the system for less motion.
// Your own choice (the toggle under the map) is remembered in this browser.
const LITE_KEY = "nook.vanlo.lite";
export function liteDefault(): boolean {
  try {
    const saved = localStorage.getItem(LITE_KEY);
    if (saved === "1" || saved === "0") return saved === "1";
  } catch {}
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
export function saveLite(on: boolean) {
  try {
    localStorage.setItem(LITE_KEY, on ? "1" : "0");
  } catch {}
}
