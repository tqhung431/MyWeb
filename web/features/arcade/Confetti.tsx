"use client";

// Stage 19: a burst of confetti over the game for a new best. One canvas, 140 paper pieces, gone after 2.5 s.
// Nothing at all if you asked your device for less motion.

import { useEffect, useRef, useState } from "react";

const COLORS = ["#ff5d8f", "#ffd166", "#06d6a0", "#4cc9f0", "#9b5de5", "#ff8c42"];

export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return setDone(true);
    const c = ref.current!;
    const box = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = box.width * dpr;
    c.height = box.height * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    const bits = Array.from({ length: 140 }, (_, i) => ({
      x: box.width / 2 + (Math.random() - 0.5) * 60,
      y: box.height * 0.45,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -0.5 - Math.random() * 0.7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.02,
      w: 5 + Math.random() * 5,
      color: COLORS[i % COLORS.length],
    }));
    const t0 = performance.now();
    let last = t0;
    let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(40, now - last);
      last = now;
      g.clearRect(0, 0, box.width, box.height);
      for (const b of bits) {
        b.vy += 0.0016 * dt;
        b.vx *= 0.995;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.r);
        g.fillStyle = b.color;
        g.fillRect(-b.w / 2, -b.w / 4, b.w, b.w / 2 + Math.abs(Math.sin(b.r * 3)) * 3);
        g.restore();
      }
      if (now - t0 < 2500) raf = requestAnimationFrame(frame);
      else setDone(true);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (done) return null;
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true" />;
}
