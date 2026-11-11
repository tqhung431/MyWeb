"use client";

// Stage 15: helpers for things that float over the page (dropdown lists, popovers).
// They're drawn in a portal at the end of <body> with position: fixed, so a parent with
// overflow: hidden (like a rounded card) can't cut them off.

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

// Phones get a bottom sheet instead of a small list under the button: easier to tap.
export function isPhone() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 639px)").matches;
}

// The anchor's place on screen, kept up to date while open (scrolling, resizing).
export function useAnchorRect(ref: RefObject<HTMLElement | null>, open: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (ref.current) setRect(ref.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [ref, open]);
  return open ? rect : null;
}

// Where to put a panel next to its anchor: below if it fits, otherwise above (whichever has more room).
export function placeNear(rect: DOMRect, { width, maxHeight, align = "start" }: { width: number; maxHeight: number; align?: "start" | "end" }) {
  const gap = 6;
  const margin = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(width, vw - margin * 2);
  let left = align === "end" ? rect.right - w : rect.left;
  left = Math.max(margin, Math.min(left, vw - w - margin));
  const below = vh - rect.bottom - gap - margin;
  const above = rect.top - gap - margin;
  const down = below >= Math.min(maxHeight, 200) || below >= above;
  const height = Math.max(120, Math.min(maxHeight, down ? below : above));
  return down ? { left, width: w, top: rect.bottom + gap, maxHeight: height } : { left, width: w, bottom: vh - rect.top + gap, maxHeight: height };
}

// Close when you tap outside or press Escape.
export function useDismiss(open: boolean, inside: RefObject<HTMLElement | null>[], onDismiss: (how: "outside" | "escape") => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!inside.some((r) => r.current?.contains(target))) onDismiss("outside");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDismiss("escape");
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
    // `inside` is a new array each render, but the refs in it never change
  }, [open, onDismiss]);
}
