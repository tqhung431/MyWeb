// A reusable toggle button. Its look comes from CSS via aria-pressed,
// just like in Stage 1 — but now the markup is written once and reused.

import type { ReactNode } from "react";

type Props = {
  pressed: boolean;
  onClick: () => void;
  className: string;
  children: ReactNode;
};

export function PillButton({ pressed, onClick, className, children }: Props) {
  return (
    <button type="button" className={className} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
