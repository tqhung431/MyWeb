// Stage 26 · Mầm Thú: every sproutling, drawn in SVG (our own designs). Small and round, big eyes, a blush:
// born where an element gathers (a raindrop, a bamboo shoot, an ember, a clay pot, a temple bell).

import type { ReactNode } from "react";
import type { SpeciesId } from "./sprout";

function Eyes({ x = 50, y = 52, gap = 11, r = 5, sleepy = false, fierce = false }: { x?: number; y?: number; gap?: number; r?: number; sleepy?: boolean; fierce?: boolean }) {
  return (
    <g>
      {[-1, 1].map((s) =>
        sleepy ? (
          <path key={s} d={`M${x + s * gap - r} ${y} q${r} ${r * 0.8} ${r * 2} 0`} stroke="#2a1a22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        ) : (
          <g key={s}>
            <ellipse cx={x + s * gap} cy={y} rx={r * 0.85} ry={r * 1.1} fill="#2a1a22" />
            <circle cx={x + s * gap - r * 0.3} cy={y - r * 0.4} r={r * 0.38} fill="#fff" />
            {fierce && <path d={`M${x + s * gap - r} ${y - r * 1.5} l${r * 2} ${s * r * 0.6}`} stroke="#2a1a22" strokeWidth="2" strokeLinecap="round" />}
          </g>
        ),
      )}
      <ellipse cx={x - gap - 4} cy={y + 8} rx="4" ry="2.4" fill="#ff7a8a" opacity="0.55" />
      <ellipse cx={x + gap + 4} cy={y + 8} rx="4" ry="2.4" fill="#ff7a8a" opacity="0.55" />
    </g>
  );
}
const Smile = ({ x = 50, y = 62, w = 5 }: { x?: number; y?: number; w?: number }) => <path d={`M${x - w} ${y} q${w} ${w * 0.8} ${w * 2} 0`} stroke="#2a1a22" strokeWidth="2" fill="none" strokeLinecap="round" />;
const Shadow = ({ w = 30 }: { w?: number }) => <ellipse cx="50" cy="92" rx={w} ry="5" fill="#000" opacity="0.15" />;

const ART: Record<SpeciesId, ReactNode> = {
  // --- Water ---
  giot: (
    <>
      <Shadow w={22} />
      <path d="M70 70 q18 4 22 -8 q-10 4 -16 -2" fill="#4aa8e0" />
      <path d="M50 18 C 38 38 26 52 26 66 a24 22 0 0 0 48 0 C 74 52 62 38 50 18 Z" fill="#6cc4f4" />
      <path d="M44 34 q-8 14 -10 26" stroke="#fff" strokeWidth="4" opacity="0.6" fill="none" strokeLinecap="round" />
      <Eyes y={62} gap={9} r={4.5} />
      <Smile y={72} w={4} />
    </>
  ),
  songGiot: (
    <>
      <Shadow w={32} />
      <path d="M22 70 q-14 -4 -14 -18 q8 8 16 6 Z" fill="#3a8fd0" />
      <path d="M78 70 q14 -4 14 -18 q-8 8 -16 6 Z" fill="#3a8fd0" />
      <path d="M50 10 C 34 34 18 50 18 66 a32 26 0 0 0 64 0 C 82 50 66 34 50 10 Z" fill="#4aa8e0" />
      <path d="M30 34 q10 -12 20 -4 q10 -12 22 2 q-12 -2 -20 8 q-8 -10 -22 -6 Z" fill="#dff4ff" />
      <path d="M40 40 q-8 12 -12 24" stroke="#fff" strokeWidth="4" opacity="0.5" fill="none" strokeLinecap="round" />
      <Eyes y={62} gap={11} r={5} fierce />
      <Smile y={74} w={5} />
    </>
  ),
  cheo: (
    <>
      <Shadow w={34} />
      <path d="M12 66 q38 34 76 0 q-6 -6 -38 -4 q-32 -2 -38 4 Z" fill="#5fae3e" />
      <path d="M50 62 l-3 24 M50 62 l18 18 M50 62 l-20 17" stroke="#3f8f4a" strokeWidth="1.5" />
      <circle cx="50" cy="52" r="20" fill="#ffd84a" />
      <circle cx="50" cy="32" r="14" fill="#ffd84a" />
      <path d="M48 18 q2 -8 6 -4" stroke="#f2b230" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M50 38 l10 2 l-10 4 Z" fill="#f28a30" />
      <Eyes y={30} gap={7} r={3.6} />
      <path d="M33 50 q-6 6 0 12" stroke="#f2c230" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  beo: (
    <>
      <Shadow w={32} />
      <ellipse cx="50" cy="74" rx="30" ry="12" fill="#8cc06a" />
      <circle cx="26" cy="80" r="6" fill="#8cc06a" />
      <circle cx="74" cy="80" r="6" fill="#8cc06a" />
      <path d="M22 70 a28 26 0 0 1 56 0 Z" fill="#3f8f4a" />
      {[[34, 56], [50, 50], [66, 56], [42, 64], [58, 64]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#7fbf4d" stroke="#3f8f4a" strokeWidth="1.5" />
      ))}
      <circle cx="84" cy="64" r="12" fill="#8cc06a" />
      <Eyes x={84} y={62} gap={4.5} r={2.6} />
    </>
  ),
  // --- Wood ---
  mamTre: (
    <>
      <Shadow w={28} />
      {[-40, -20, 0, 20, 40].map((a) => (
        <path key={a} d="M50 52 l-5 -34 l5 -6 l5 6 Z" fill="#7fbf4d" transform={`rotate(${a} 50 60)`} />
      ))}
      <ellipse cx="50" cy="64" rx="28" ry="24" fill="#a07040" />
      <ellipse cx="50" cy="70" rx="18" ry="15" fill="#e8c9a0" />
      <Eyes y={64} gap={10} r={4.2} />
      <circle cx="50" cy="72" r="2.6" fill="#2a1a22" />
    </>
  ),
  luyTre: (
    <>
      <Shadow w={36} />
      {[-50, -28, -8, 12, 32, 52].map((a, i) => (
        <g key={a} transform={`rotate(${a} 50 62)`}>
          <rect x="46" y="10" width="8" height="46" rx="3" fill={i % 2 ? "#5fae3e" : "#7fbf4d"} />
          <rect x="46" y="26" width="8" height="2" fill="#3f8f4a" />
          <path d="M54 16 q12 -6 16 2 q-10 0 -16 4 Z" fill="#9fd86a" />
        </g>
      ))}
      <ellipse cx="50" cy="66" rx="34" ry="26" fill="#8a5a2b" />
      <ellipse cx="50" cy="72" rx="22" ry="17" fill="#e8c9a0" />
      <Eyes y={66} gap={12} r={5} fierce />
      <circle cx="50" cy="76" r="3" fill="#2a1a22" />
    </>
  ),
  namLun: (
    <>
      <Shadow w={24} />
      <rect x="36" y="52" width="28" height="34" rx="12" fill="#fff4e0" />
      <path d="M14 56 C 14 22 86 22 86 56 C 70 62 30 62 14 56 Z" fill="#e0453a" />
      {[[30, 40, 5], [50, 32, 6], [70, 42, 4.5], [40, 50, 3.5], [62, 52, 3.5]].map(([x, y, r]) => (
        <circle key={`${x}`} cx={x} cy={y} r={r} fill="#fff" />
      ))}
      <Eyes y={70} gap={7} r={3.4} sleepy />
      <text x="70" y="22" fontSize="12" fill="#8a7fb0" fontWeight="700">z</text>
      <text x="78" y="14" fontSize="9" fill="#8a7fb0" fontWeight="700">z</text>
    </>
  ),
  // --- Fire ---
  thanHong: (
    <>
      <Shadow w={26} />
      <path d="M72 70 q20 -6 14 -26 q-2 10 -8 10 q4 -12 -4 -18 q2 14 -8 22 Z" fill="#f2b230" />
      <path d="M74 70 q12 -6 8 -18 q-4 8 -10 8 Z" fill="#ff5c3a" />
      <ellipse cx="50" cy="68" rx="24" ry="20" fill="#ff7a45" />
      <path d="M28 46 l4 -20 l14 14 Z M72 46 l-4 -20 l-14 14 Z" fill="#ff7a45" />
      <path d="M32 40 l2 -10 l6 6 Z M68 40 l-2 -10 l-6 6 Z" fill="#ffc9a0" />
      <circle cx="50" cy="52" r="22" fill="#ff7a45" />
      <Eyes y={52} gap={9} r={4.4} />
      <path d="M46 61 l4 3 l4 -3" stroke="#2a1a22" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M44 34 q6 -6 12 0" stroke="#ffd27a" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  bepLua: (
    <>
      <Shadow w={34} />
      <path d="M50 4 q-14 14 -26 10 q6 6 2 14 q-14 -2 -18 10 q12 -2 14 6 q20 -4 28 -40 Z" fill="#f2b230" />
      <path d="M50 4 q14 14 26 10 q-6 6 -2 14 q14 -2 18 10 q-12 -2 -14 6 q-20 -4 -28 -40 Z" fill="#f2b230" />
      <path d="M50 12 q-10 12 -18 12 q8 10 18 4 q10 6 18 -4 q-8 0 -18 -12 Z" fill="#ff5c3a" />
      <ellipse cx="50" cy="70" rx="30" ry="22" fill="#e0453a" />
      <circle cx="50" cy="50" r="24" fill="#ff6a3a" />
      <path d="M26 72 h48 v8 h-48 Z" fill="#7a5528" />
      <rect x="30" y="74" width="8" height="4" fill="#9a7048" />
      <rect x="62" y="74" width="8" height="4" fill="#9a7048" />
      <Eyes y={50} gap={10} r={4.8} fierce />
      <path d="M45 60 l5 3 l5 -3" stroke="#2a1a22" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  ),
  denTroi: (
    <>
      <Shadow w={18} />
      <circle cx="50" cy="56" r="34" fill="#ffd27a" opacity="0.25" />
      <path d="M50 52 C 26 30 8 36 14 54 C 18 66 36 62 50 56 Z" fill="#f7c4a0" />
      <path d="M50 52 C 74 30 92 36 86 54 C 82 66 64 62 50 56 Z" fill="#f7c4a0" />
      <path d="M50 52 C 32 40 22 44 24 52" stroke="#e0453a" strokeWidth="2" fill="none" />
      <path d="M50 52 C 68 40 78 44 76 52" stroke="#e0453a" strokeWidth="2" fill="none" />
      <path d="M38 40 h24 l4 30 q-16 8 -32 0 Z" fill="#ff8a3a" />
      <rect x="40" y="36" width="20" height="5" rx="2" fill="#b2222a" />
      <path d="M44 36 q-4 -14 -10 -18 M56 36 q4 -14 10 -18" stroke="#7a5528" strokeWidth="2" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="66" rx="6" ry="4" fill="#fff4c2" />
      <Eyes y={52} gap={6} r={3.4} />
    </>
  ),
  // --- Earth ---
  gom: (
    <>
      <Shadow w={28} />
      <ellipse cx="50" cy="64" rx="30" ry="24" fill="#c06a3a" />
      {[44, 56, 68].map((y) => (
        <path key={y} d={`M${24 + (y - 44) / 3} ${y} q26 8 ${52 - ((y - 44) * 2) / 3} 0`} stroke="#8a4a2a" strokeWidth="3" fill="none" />
      ))}
      <ellipse cx="50" cy="40" rx="16" ry="6" fill="#8a4a2a" />
      <ellipse cx="50" cy="40" rx="11" ry="3.5" fill="#5a2a1a" />
      <circle cx="22" cy="72" r="10" fill="#e09a6a" />
      <Eyes x={22} y={70} gap={4} r={2.4} />
      <rect x="32" y="84" width="8" height="6" rx="3" fill="#8a4a2a" />
      <rect x="60" y="84" width="8" height="6" rx="3" fill="#8a4a2a" />
    </>
  ),
  loGom: (
    <>
      <Shadow w={36} />
      <rect x="58" y="8" width="12" height="22" rx="3" fill="#7a3a22" />
      <circle cx="64" cy="6" r="5" fill="#cfc6d6" opacity="0.8" />
      <circle cx="72" cy="0" r="4" fill="#cfc6d6" opacity="0.6" />
      <path d="M14 82 C 14 34 86 34 86 82 Z" fill="#b0582e" />
      {[50, 62, 74].map((y) => (
        <path key={y} d={`M${18} ${y} q32 10 64 0`} stroke="#7a3a22" strokeWidth="3.5" fill="none" />
      ))}
      <path d="M38 82 v-14 a12 12 0 0 1 24 0 v14 Z" fill="#2a1a22" />
      <path d="M42 82 q8 -16 16 0 Z" fill="#ff8a3a" />
      <Eyes y={52} gap={13} r={5} fierce />
    </>
  ),
  datSet: (
    <>
      <Shadow w={30} />
      <ellipse cx="50" cy="68" rx="30" ry="20" fill="#9a6a3a" />
      <circle cx="34" cy="44" r="11" fill="#9a6a3a" />
      <circle cx="66" cy="44" r="11" fill="#9a6a3a" />
      <Eyes y={44} gap={16} r={4.6} />
      <path d="M36 66 q14 10 28 0" stroke="#2a1a22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {[[28, 78, 5], [70, 76, 6], [56, 84, 4]].map(([x, y, r]) => (
        <circle key={x} cx={x} cy={y} r={r} fill="#6b4a2b" />
      ))}
      <path d="M20 84 q-8 2 -10 6 h14 Z M80 84 q8 2 10 6 h-14 Z" fill="#7a5528" />
    </>
  ),
  // --- Metal ---
  chuongNho: (
    <>
      <Shadow w={24} />
      <path d="M40 22 q-6 -12 -14 -12 M60 22 q6 -12 14 -12" stroke="#5a4a2a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="26" cy="10" r="3" fill="#5a4a2a" />
      <circle cx="74" cy="10" r="3" fill="#5a4a2a" />
      <path d="M30 76 C 30 30 70 30 70 76 Z" fill="#e8c24a" />
      <rect x="26" y="74" width="48" height="8" rx="4" fill="#c9a227" />
      <path d="M50 30 v46" stroke="#c9a227" strokeWidth="2" />
      <circle cx="50" cy="88" r="5" fill="#c9a227" />
      <path d="M30 84 l-8 6 M70 84 l8 6 M36 86 l-4 8 M64 86 l4 8" stroke="#5a4a2a" strokeWidth="2.4" strokeLinecap="round" />
      <Eyes y={54} gap={9} r={4.2} />
    </>
  ),
  daiChuong: (
    <>
      <Shadow w={36} />
      <rect x="44" y="4" width="12" height="10" rx="3" fill="#8a6a1a" />
      <path d="M20 80 C 20 14 80 14 80 80 Z" fill="#d4a62a" />
      <rect x="14" y="76" width="72" height="10" rx="5" fill="#a9821a" />
      {[[32, 34], [50, 30], [68, 34]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3" fill="#a9821a" />
      ))}
      <path d="M26 46 h48 M24 62 h52" stroke="#a9821a" strokeWidth="2.4" />
      <path d="M18 86 l-10 8 M82 86 l10 8 M30 88 l-4 8 M70 88 l4 8" stroke="#5a4a2a" strokeWidth="3" strokeLinecap="round" />
      <Eyes y={54} gap={12} r={5} fierce />
    </>
  ),
  xu: (
    <>
      <Shadow w={32} />
      <path d="M16 56 q-12 -10 -4 -22 q4 8 12 8 Z" fill="#c9a227" />
      <path d="M84 56 q12 -10 4 -22 q-4 8 -12 8 Z" fill="#c9a227" />
      <path d="M22 76 l-10 10 M30 80 l-6 10 M78 76 l10 10 M70 80 l6 10" stroke="#a9821a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="62" r="28" fill="#e8c24a" />
      <circle cx="50" cy="62" r="22" fill="none" stroke="#c9a227" strokeWidth="2" />
      <rect x="44" y="56" width="12" height="12" fill="#a9821a" />
      <path d="M40 34 v-10 M60 34 v-10" stroke="#a9821a" strokeWidth="2.4" />
      <circle cx="40" cy="22" r="5" fill="#fff" stroke="#a9821a" strokeWidth="1.5" />
      <circle cx="60" cy="22" r="5" fill="#fff" stroke="#a9821a" strokeWidth="1.5" />
      <circle cx="40" cy="23" r="2.6" fill="#2a1a22" />
      <circle cx="60" cy="23" r="2.6" fill="#2a1a22" />
      <Smile y={80} w={4} />
    </>
  ),
  kimChi: (
    <>
      <Shadow w={18} />
      <ellipse cx="34" cy="38" rx="22" ry="7" fill="#dfe8f4" opacity="0.85" transform="rotate(-20 34 38)" />
      <ellipse cx="66" cy="38" rx="22" ry="7" fill="#dfe8f4" opacity="0.85" transform="rotate(20 66 38)" />
      <ellipse cx="34" cy="50" rx="18" ry="6" fill="#cfd8e8" opacity="0.85" transform="rotate(10 34 50)" />
      <ellipse cx="66" cy="50" rx="18" ry="6" fill="#cfd8e8" opacity="0.85" transform="rotate(-10 66 50)" />
      <rect x="47" y="40" width="6" height="44" rx="3" fill="#9aa8bc" />
      <path d="M50 84 q10 6 4 12 q-8 2 -2 -6" stroke="#e0453a" strokeWidth="1.5" fill="none" />
      <circle cx="50" cy="32" r="12" fill="#b8c4d6" />
      <Eyes y={32} gap={6} r={3.4} />
    </>
  ),
};

export function Creature({ species, size = 96, flip = false, className, title }: { species: SpeciesId; size?: number; flip?: boolean; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform={flip ? "translate(100 0) scale(-1 1)" : undefined}>{ART[species]}</g>
    </svg>
  );
}
