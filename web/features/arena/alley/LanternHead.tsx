// Stage 23 · Ngõ Pháo: the lantern-head character as a small SVG, for menus (seats, colour and hat pickers).
// The game itself draws the same character with PixiJS (art.ts).

import { PLAYER_COLORS } from "./colors";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export function LanternHead({ color, hat, size = 56, ghost = false, title }: { color: number; hat: number; size?: number; ghost?: boolean; title?: string }) {
  const c = PLAYER_COLORS[color % PLAYER_COLORS.length];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {ghost ? (
        <path d="M14 28 C14 6 50 6 50 28 L50 50 Q46 44 42 50 Q38 56 34 50 Q30 44 26 50 Q22 56 18 50 Q16 46 14 50 Z" fill="#f4f0ff" opacity="0.85" stroke={hex(c.light)} strokeWidth="2" />
      ) : (
        <>
          <ellipse cx="32" cy="58" rx="15" ry="4" fill="#000" opacity="0.25" />
          <rect x="21" y="38" width="22" height="17" rx="8" fill={hex(c.dark)} />
          <rect x="21" y="44" width="22" height="3" fill="#f2c94c" />
          <ellipse cx="32" cy="27" rx="20" ry="17" fill={hex(c.body)} />
          <ellipse cx="25" cy="19" rx="7" ry="5" fill="#fff" opacity="0.28" />
          <rect x="22" y="8" width="20" height="5" rx="2" fill="#f2c94c" />
          <rect x="23" y="41" width="18" height="4" rx="2" fill="#f2c94c" />
          <ellipse cx="32" cy="29" rx="15" ry="11" fill="#fff1e0" opacity="0.9" />
        </>
      )}
      {[-1, 1].map((s) => (
        <g key={s}>
          <ellipse cx={32 + s * 7} cy={ghost ? 26 : 27} rx="4.2" ry="5.4" fill="#2a1a22" />
          <ellipse cx={32 + s * 7} cy={ghost ? 27.5 : 28.5} rx="3" ry="3" fill="#6b3fa0" />
          <circle cx={30.6 + s * 7} cy={ghost ? 24 : 25} r="1.7" fill="#fff" />
          <ellipse cx={32 + s * 11} cy={ghost ? 32 : 33} rx="3.2" ry="1.8" fill="#ff7a8a" opacity="0.55" />
        </g>
      ))}
      <path d={ghost ? "M30 32 Q32 34.5 34 32" : "M30 33 Q32 35.5 34 33"} stroke="#2a1a22" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {!ghost && hat === 1 && <path d="M15 15 L32 -3 L49 15 Z" fill="#f3dfa2" stroke="#c9a85c" strokeWidth="1.5" />}
      {!ghost && hat === 2 && (
        <>
          <path d="M26 13 L18 1 L16 15 Z" fill={hex(c.dark)} />
          <path d="M38 13 L46 1 L48 15 Z" fill={hex(c.dark)} />
        </>
      )}
      {!ghost && hat === 3 && (
        <>
          <path d="M36 11 L46 3 L46 17 Z M36 11 L26 3 L26 17 Z" fill="#ff5c8a" />
          <circle cx="36" cy="11" r="3.5" fill="#ff8fb0" />
        </>
      )}
      {!ghost && hat === 4 && (
        <>
          <path d="M25 13 Q23 3 17 0 Q20 7 21 14 Z" fill="#f2c94c" />
          <path d="M39 13 Q41 3 47 0 Q44 7 43 14 Z" fill="#f2c94c" />
        </>
      )}
    </svg>
  );
}
