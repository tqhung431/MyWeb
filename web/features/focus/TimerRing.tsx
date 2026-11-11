// A circular progress ring drawn with SVG. The coloured arc shrinks as time runs out.
//
// The trick: a circle's outline is a dashed line one dash long.
// strokeDashoffset slides the dash, so offset = 0 is full and offset = circumference is empty.

import { useId, type ReactNode } from "react";

type Props = {
  value: number; // 1 = full ring, 0 = empty
  children: ReactNode;
  size?: number;
  stroke?: number;
};

export function TimerRing({ value, children, size = 280, stroke = 14 }: Props) {
  // Unique per ring, so two rings on a page don't clash. React ids contain symbols that
  // url(#…) dislikes, so keep only letters and digits.
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value)));

  return (
    <div className="relative mx-auto aspect-square w-full" style={{ maxWidth: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-muted)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}
