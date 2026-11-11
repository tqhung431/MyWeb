"use client";

// Stage 15: a small panel that opens under a button (like the theme picker in the phone header).
//
//   <Popover label="Theme" button={<Palette />}>{(close) => <div>…</div>}</Popover>

import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { placeNear, useAnchorRect, useDismiss } from "@/lib/floating";
import { cn } from "@/lib/cn";

type Props = {
  label: string; // the button's name for screen readers
  button: ReactNode; // what the button shows (usually an icon)
  buttonClassName?: string;
  bare?: boolean; // skip the round icon-button look (buttonClassName styles it instead)
  width?: number;
  align?: "start" | "end";
  children: (close: () => void) => ReactNode;
};

export function Popover({ label, button, buttonClassName, bare = false, width = 288, align = "end", children }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rect = useAnchorRect(buttonRef, open);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);
  useDismiss(
    open,
    [buttonRef, panelRef],
    useCallback((how) => close(how === "escape"), [close]),
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center border border-border transition focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          !bare && "h-9 w-9 rounded-full bg-surface-strong/70 text-muted hover:text-text",
          open && !bare && "text-text",
          buttonClassName,
        )}
      >
        {button}
      </button>
      {rect &&
        createPortal(
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            className="fixed z-[70] animate-pop overflow-y-auto rounded-3xl border border-border bg-surface-strong p-4 text-text shadow-2xl shadow-black/15"
            style={placeNear(rect, { width, maxHeight: 520, align })}
          >
            {children(() => close())}
          </div>,
          document.body,
        )}
    </>
  );
}
