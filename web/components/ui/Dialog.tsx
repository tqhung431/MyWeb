"use client";

// Stage 15: a dialog box in Nook's own style, and useConfirm() to replace the browser's window.confirm().
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: "Delete this post?", confirmLabel: "Delete", danger: true }))) return;
//
// A dialog is "modal": the page behind can't be used until it closes. Focus moves into the dialog,
// Tab stays inside it, Esc closes it, and focus goes back to the button you came from.

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode; // buttons at the bottom
  className?: string;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export function Dialog({ open, onClose, title, description, children, actions, className }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    // The last button is the main action; start on the first one so Enter can't delete by accident
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden"; // no scrolling the page behind
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, [open]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
    if (e.key !== "Tab" || !panel.current) return;
    // Keep Tab inside the dialog
    const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (items.length === 0) return e.preventDefault();
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md animate-pop rounded-t-3xl border border-border bg-surface-strong p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-text shadow-2xl focus:outline-none sm:rounded-3xl sm:pb-6",
          className,
        )}
      >
        <h2 id={`${id}-title`} className="text-lg font-bold tracking-tight">
          {title}
        </h2>
        {description && (
          <p id={`${id}-desc`} className="mt-1.5 text-sm text-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        {actions && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ---- useConfirm ----

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Ask = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setAsk({ ...o, resolve })), []);
  const answer = (ok: boolean) => {
    ask?.resolve(ok);
    setAsk(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!ask}
        onClose={() => answer(false)}
        title={ask?.title}
        description={ask?.description}
        actions={
          <>
            <Button variant="ghost" onClick={() => answer(false)} data-autofocus>
              {ask?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={ask?.danger ? "danger" : "primary"} onClick={() => answer(true)}>
              {ask?.confirmLabel ?? "OK"}
            </Button>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

// Outside the provider (in tests) it falls back to the browser's own confirm box.
export function useConfirm() {
  return useContext(ConfirmContext) ?? (async (o: ConfirmOptions) => window.confirm(o.description ? `${o.title}\n\n${o.description}` : o.title));
}
