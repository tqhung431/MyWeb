"use client";

// Stage 18: an on-screen joystick for phones and tablets. Hold and push the knob to keep walking in one of 8 directions.
// It only shows on touch screens; tapping the map still works too.

import { useEffect, useRef, useState } from "react";
import type { Pos } from "../engine/grid";

const R = 36; // how far the knob can travel, in px
const DEAD = 14; // a small push does nothing

// The 8 directions, by angle
export function dirFromVector(dx: number, dy: number): Pos | null {
  if (Math.hypot(dx, dy) < DEAD) return null;
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  const a = (sector * Math.PI) / 4;
  return { x: Math.round(Math.cos(a)), y: Math.round(Math.sin(a)) };
}

export function Joystick({ onDir, label }: { onDir: (d: Pos | null) => void; label: string }) {
  const [touch, setTouch] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const base = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setTouch(mq.matches);
    const on = () => setTouch(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  if (!touch) return null;

  const move = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    const box = base.current!.getBoundingClientRect();
    let dx = e.clientX - (box.left + box.width / 2);
    let dy = e.clientY - (box.top + box.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > R) {
      dx = (dx / len) * R;
      dy = (dy / len) * R;
    }
    setKnob({ x: dx, y: dy });
    onDir(dirFromVector(dx, dy));
  };
  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    setKnob({ x: 0, y: 0 });
    onDir(null);
  };

  return (
    <div
      ref={base}
      role="group"
      aria-label={label}
      className="absolute bottom-3 left-3 h-24 w-24 touch-none rounded-full border border-white/40 bg-black/15 shadow-lg backdrop-blur-[2px] select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        e.stopPropagation();
        end(e);
      }}
      onPointerCancel={end}
    >
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-10 w-10 rounded-full border border-white/70 bg-white/50 shadow-md"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
