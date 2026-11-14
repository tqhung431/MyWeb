"use client";

// Stage 28: the small menu for one chat message. Opens on a tap (phone), a right-click (PC), or the "⋯"
// button next to the message (keyboard). Arrow keys move between items, Escape closes it.

import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { placeNear, useAnchorRect, useDismiss } from "@/lib/floating";

export type MenuAction = { id: string; label: string; icon: LucideIcon; onSelect: () => void; danger?: boolean };

export function MessageMenu({ anchor, label, actions, onClose }: { anchor: HTMLElement; label: string; actions: MenuAction[]; onClose: () => void }) {
  const anchorRef = useRef<HTMLElement | null>(anchor);
  const panel = useRef<HTMLDivElement>(null);
  const rect = useAnchorRect(anchorRef, true);
  useDismiss(true, [anchorRef, panel], useCallback(() => onClose(), [onClose]));

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [rect === null]); // eslint-disable-line react-hooks/exhaustive-deps -- once, when it appears

  function onKeyDown(e: KeyboardEvent) {
    const items = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (e.key === "Tab") {
      onClose();
    }
  }

  if (!rect) return null;
  return createPortal(
    <div
      ref={panel}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="fixed z-[70] flex animate-pop flex-col overflow-hidden rounded-2xl border border-border bg-surface-strong p-1 text-text shadow-2xl shadow-black/15"
      style={placeNear(rect, { width: 180, maxHeight: 260, align: "start" })}
    >
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            a.onSelect();
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
            a.danger && "text-rose-600 dark:text-rose-400",
          )}
        >
          <a.icon className="h-4 w-4" aria-hidden="true" />
          {a.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
