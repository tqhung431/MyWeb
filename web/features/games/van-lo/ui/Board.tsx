"use client";

// The map on a <canvas>. React draws the menus; this draws the world, 60 times a second:
// the painted floor, what you remember (in mist), what you see, characters gliding between tiles,
// and the effects of the last turn (numbers, sword strokes, lightning).

import { useEffect, useRef } from "react";
import type { Pos } from "../engine/grid";
import type { Run } from "../logic/types";
import type { Fx } from "../logic/world";
import { ANIM_MS, DARK, drawAnim, drawEnemy, drawPlayer, drawThing, LIGHT, paintFloor, type Anim } from "./draw";

type Props = {
  run: Run;
  seen: Set<number>; // visible now
  dark: boolean;
  fx: { id: number; list: Fx[] } | null;
  targets: Pos[] | null;
  onTap: (p: Pos) => void;
  className?: string;
};

export function Board({ run, seen, dark, fx, targets, onTap, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ run, seen, dark, targets });
  props.current = { run, seen, dark, targets };
  const anims = useRef<Anim[]>([]);
  const shown = useRef<{ player: Pos | null; enemies: Map<string, Pos> }>({ player: null, enemies: new Map() });
  const view = useRef({ tile: 32, cam: { x: 0, y: 0 }, w: 0, h: 0 });
  const texture = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);

  // New effects from the last turn
  useEffect(() => {
    if (!fx) return;
    const now = performance.now();
    const add = (a: Anim) => anims.current.push(a);
    const ink = dark ? DARK : LIGHT;
    for (const f of fx.list) {
      if (f.type === "hit")
        add({
          kind: "number",
          at: f.at,
          text: String(f.amount),
          color: f.onPlayer ? "#d23b2e" : f.crit ? "#e0782f" : ink.ink,
          big: f.crit,
          start: now,
        });
      else if (f.type === "miss") add({ kind: "number", at: f.at, text: "né", color: ink.jade, start: now });
      else if (f.type === "slash") add({ kind: "slash", from: f.from, to: f.to, color: f.color ?? ink.ink, start: now });
      else if (f.type === "bolt") add({ kind: "bolt", at: f.at, start: now });
      else if (f.type === "area") add({ kind: "ring", at: f.at, r: f.r, color: f.color ?? ink.gold, start: now });
      else if (f.type === "heal") add({ kind: "number", at: f.at, text: `+${f.amount}`, color: f.qi ? "#3f6f9a" : "#3f7d4b", start: now });
      else if (f.type === "die") add({ kind: "splash", at: f.at, start: now + 80 });
      else if (f.type === "text")
        add({
          kind: "number",
          at: f.at,
          text: f.text,
          color: f.tone === "bad" ? "#d23b2e" : f.tone === "loot" ? ink.gold : f.tone === "good" ? ink.jade : ink.ink,
          start: now + 60,
        });
    }
  }, [fx, dark]);

  // Size the canvas to its box (sharp on high-density screens)
  useEffect(() => {
    const canvas = canvasRef.current!;
    const fit = () => {
      const box = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(box.width * dpr);
      canvas.height = Math.round(box.height * dpr);
      const across = box.width < 500 ? 11 : box.width < 900 ? 15 : 19;
      view.current = { ...view.current, tile: Math.max(26, Math.min(48, Math.floor(box.width / across))), w: box.width, h: box.height };
      texture.current = null;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // The drawing loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const g = canvas.getContext("2d")!;
    let frame = 0;
    let last = performance.now();

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(64, now - last);
      last = now;
      const { run: r, seen: vis, dark: isDark, targets: tg } = props.current;
      const ink = isDark ? DARK : LIGHT;
      const { tile, w, h } = view.current;
      if (!w) return;
      const dpr = canvas.width / w;
      const f = r.floor;
      const tribulation = r.kind === "tribulation";

      // Glide the player and enemies towards their real tiles
      const ease = 1 - Math.exp(-dt / 55);
      const sp = shown.current;
      if (!sp.player || Math.abs(sp.player.x - r.pos.x) + Math.abs(sp.player.y - r.pos.y) > 6) sp.player = { ...r.pos };
      sp.player = { x: sp.player.x + (r.pos.x - sp.player.x) * ease, y: sp.player.y + (r.pos.y - sp.player.y) * ease };
      const alive = new Set<string>();
      for (const e of f.enemies) {
        alive.add(e.uid);
        const old = sp.enemies.get(e.uid);
        if (!old || Math.abs(old.x - e.pos.x) + Math.abs(old.y - e.pos.y) > 4) sp.enemies.set(e.uid, { ...e.pos });
        else sp.enemies.set(e.uid, { x: old.x + (e.pos.x - old.x) * ease, y: old.y + (e.pos.y - old.y) * ease });
      }
      for (const id of [...sp.enemies.keys()]) if (!alive.has(id)) sp.enemies.delete(id);

      // Camera: follow the player, stay inside the map (or centre a small map)
      const across = w / tile;
      const down = h / tile;
      const camX = f.w <= across ? (f.w - across) / 2 : Math.max(0, Math.min(f.w - across, sp.player.x + 0.5 - across / 2));
      const camY = f.h <= down ? (f.h - down) / 2 : Math.max(0, Math.min(f.h - down, sp.player.y + 0.5 - down / 2));
      view.current.cam = { x: camX, y: camY };
      const toScreen = (p: Pos) => ({ x: (p.x - camX) * tile + tile / 2, y: (p.y - camY) * tile + tile / 2 });

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = tribulation ? (isDark ? "#0f0e14" : "#cfc9c0") : ink.paper;
      g.fillRect(0, 0, w, h);

      const key = `${f.tiles}|${f.depth}|${tile}|${isDark}|${dpr}`;
      if (texture.current?.key !== key) texture.current = { key, canvas: paintFloor(f, tile, ink, dpr, tribulation) };
      g.drawImage(texture.current.canvas, -camX * tile, -camY * tile, f.w * tile, f.h * tile);

      const x0 = Math.max(0, Math.floor(camX));
      const y0 = Math.max(0, Math.floor(camY));
      const x1 = Math.min(f.w - 1, Math.ceil(camX + across));
      const y1 = Math.min(f.h - 1, Math.ceil(camY + down));
      const idx = (x: number, y: number) => y * f.w + x;

      // Things you've seen (remembered ones are drawn under the mist)
      for (const th of f.things) {
        if (f.seen[idx(th.pos.x, th.pos.y)] !== "1") continue;
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

      // Mist: never seen = blank paper; seen before = faded. (The tribulation arena is all open sky.)
      for (let y = y0; y <= y1 && !tribulation; y++)
        for (let x = x0; x <= x1; x++) {
          const i = idx(x, y);
          const a = vis.has(i) ? 0 : f.seen[i] === "1" ? 0.5 : 1;
          if (!a) continue;
          g.fillStyle = `${ink.mist}${a})`;
          g.fillRect((x - camX) * tile - 0.5, (y - camY) * tile - 0.5, tile + 1, tile + 1);
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

      // Enemies you can see, then you
      for (const e of f.enemies) {
        const ghostInWall = f.tiles[idx(e.pos.x, e.pos.y)] === "#";
        if (!vis.has(idx(e.pos.x, e.pos.y)) && !(ghostInWall && Math.max(Math.abs(e.pos.x - r.pos.x), Math.abs(e.pos.y - r.pos.y)) <= 1)) continue;
        const p = toScreen(sp.enemies.get(e.uid) ?? e.pos);
        drawEnemy(g, e, p.x, p.y, tile, ink);
      }
      const me = toScreen(sp.player);
      drawPlayer(g, me.x, me.y, tile, ink, {
        shield: r.status.some((s) => s.kind === "shield" || s.kind === "block"),
        echo: r.status.some((s) => s.kind === "echo"),
      });

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
