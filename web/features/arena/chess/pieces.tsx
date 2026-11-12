// Stage 22: Nook's own chess pieces, drawn in code (SVG, 100×100 each). Rounded, chunky shapes that read well
// on a small phone board. White pieces are cream with a dark outline; black pieces are ink with a light rim.

import type { ReactNode } from "react";

export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";

const BASE = <path d="M22 86h56a4 4 0 0 0 4-4v-3a6 6 0 0 0-6-6H24a6 6 0 0 0-6 6v3a4 4 0 0 0 4 4z" />;

const SHAPES: Record<PieceType, ReactNode> = {
  p: (
    <>
      {BASE}
      <path d="M36 73c2-12 6-20 9-24h10c3 4 7 12 9 24z" />
      <circle cx="50" cy="36" r="13" />
    </>
  ),
  r: (
    <>
      {BASE}
      <path d="M30 73l3-34h34l3 34z" />
      <path d="M26 39V22h10v7h8v-7h12v7h8v-7h10v17z" />
    </>
  ),
  n: (
    <>
      {BASE}
      <path d="M30 73c0-14 6-22 14-28-6 1-12 4-17 2-4-2-4-7-1-11 6-8 14-16 25-20l2-6 6 7c12 4 17 16 16 30-1 10-4 18-3 26z" />
      <circle cx="49" cy="27" r="3.5" fill="currentColor" stroke="none" />
    </>
  ),
  b: (
    <>
      {BASE}
      <path d="M36 73c1-8 4-14 7-17h14c3 3 6 9 7 17z" />
      <path d="M50 14c11 8 17 18 17 27 0 8-7 15-17 15s-17-7-17-15c0-9 6-19 17-27z" />
      <path d="M54 26l-9 13" fill="none" />
      <circle cx="50" cy="11" r="5" />
    </>
  ),
  q: (
    <>
      {BASE}
      <path d="M30 73l-6-42 15 18 11-27 11 27 15-18-6 42z" />
      <circle cx="24" cy="28" r="5" />
      <circle cx="39" cy="20" r="4.5" />
      <circle cx="50" cy="15" r="5" />
      <circle cx="61" cy="20" r="4.5" />
      <circle cx="76" cy="28" r="5" />
    </>
  ),
  k: (
    <>
      {BASE}
      <path d="M30 73l-4-30c8-6 16-8 24-8s16 2 24 8l-4 30z" />
      <path d="M46 8h8v8h8v8h-8v12h-8V24h-8v-8h8z" />
    </>
  ),
};

export function Piece({ type, color, className }: { type: PieceType; color: Color; className?: string }) {
  const white = color === "w";
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" style={{ color: white ? "#3a2f2a" : "#f3e7d3" }}>
      <g
        fill={white ? "#fbf4e6" : "#2b2433"}
        stroke={white ? "#3a2f2a" : "#f3e7d3"}
        strokeWidth={white ? 4 : 3}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 3px 2px rgba(0,0,0,0.28))" }}
      >
        {SHAPES[type]}
      </g>
    </svg>
  );
}

