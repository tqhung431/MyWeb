"use client";

// Stage 15: Nook's own dropdown, replacing the browser's <select>.
//
// Why: a native <select> opens a list drawn by the browser or phone. It ignores our colours, corners
// and dark mode, and looks different on every device. This one looks the same everywhere and follows
// the theme. On phones the list opens as a sheet from the bottom of the screen, easy to tap.
//
//   <Select label="Shelf" showLabel value={status} onChange={setStatus}
//           options={[{ value: "reading", label: "Reading now" }, ...]} />
//
// Accessibility follows the "select-only combobox" pattern from the WAI-ARIA guide: focus stays on the
// button, the list is a listbox, and aria-activedescendant tells screen readers which option is active.
// Keys: ↓ ↑ Home End to move, Enter or Space to pick, Esc to close, or type letters to jump.
// With `searchable`, a search box at the top of the list filters it (for long lists).

import { Check, ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isPhone, placeNear, useAnchorRect, useDismiss } from "@/lib/floating";
import { cn } from "@/lib/cn";

import { useT } from "@/lib/i18n/I18nProvider";
export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
  hint?: string; // a second, smaller line
  icon?: ReactNode;
  danger?: boolean; // e.g. "Remove from my list"
};

type Props<T extends string | number> = {
  label: string; // always read by screen readers; shown above the button with showLabel
  showLabel?: boolean;
  value: T | null;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  variant?: "field" | "pill"; // field: like a text input; pill: small and round, for toolbars and cards
  size?: "xs" | "sm" | "md"; // pill height: 28, 36 or 44 px
  searchable?: boolean;
  disabled?: boolean;
  className?: string; // the outer wrapper
  buttonClassName?: string; // extra classes for the button (colours, height, width)
};

const PILL_SIZES = { xs: "h-7 px-2.5 text-xs", sm: "h-9 px-3.5 text-xs", md: "h-11 px-4 text-sm" };

// Letters without accents, lower case: "Tiếng Việt" matches "tieng viet"
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export function Select<T extends string | number>({
  label,
  showLabel = false,
  value,
  options,
  onChange,
  placeholder,
  variant = "field",
  size = "sm",
  searchable = false,
  disabled = false,
  className,
  buttonClassName,
}: Props<T>) {
  const t = useT();
  const id = useId();
  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const rect = useAnchorRect(buttonRef, open && !sheet);

  const selected = options.find((o) => o.value === value) ?? null;
  const shown = searchable && query.trim() ? options.filter((o) => fold(o.label).includes(fold(query.trim()))) : options;

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);
  useDismiss(
    open,
    [buttonRef, panelRef],
    useCallback((how) => close(how === "escape"), [close]),
  );

  function show() {
    if (disabled) return;
    setSheet(isPhone());
    setQuery("");
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  }

  function choose(option: SelectOption<T> | undefined) {
    if (!option) return;
    close();
    if (option.value !== value) onChange(option.value);
  }

  // Keep the active option visible while moving with the keyboard
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // optionId only depends on id, which never changes
  }, [open, active]);

  // Typing letters jumps to the next option starting with them (like a native select)
  function typeahead(key: string) {
    const now = Date.now();
    typed.current = { text: now - typed.current.at > 700 ? key : typed.current.text + key, at: now };
    const text = fold(typed.current.text);
    const from = typed.current.text.length === 1 ? active + 1 : active;
    for (let n = 0; n < shown.length; n++) {
      const i = (Math.max(0, from) + n) % shown.length;
      if (fold(shown[i].label).startsWith(text)) return i;
    }
    return -1;
  }

  function onKeyDown(e: KeyboardEvent) {
    const last = shown.length - 1;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !searchable) {
        // Closed + a letter: pick the matching option straight away, like a native select
        const i = typeahead(e.key);
        if (i >= 0 && shown[i].value !== value) onChange(shown[i].value);
      }
      return;
    }
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "PageDown":
        return move(active + 6);
      case "PageUp":
        return move(active - 6);
      case "Enter":
        e.preventDefault();
        return choose(shown[active]);
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // close only this list, not a dialog around it
        return close();
      case "Tab":
        return close(false);
      case " ":
        if (searchable) return; // a space in the search box
        e.preventDefault();
        return choose(shown[active]);
      default:
        if (!searchable && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = typeahead(e.key);
          if (i >= 0) setActive(i);
        }
    }
  }

  const listbox = (
    <ul
      id={listId}
      role="listbox"
      aria-labelledby={showLabel ? labelId : undefined}
      aria-label={showLabel ? undefined : t(label)}
      tabIndex={-1}
      className={cn("flex flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5", sheet && "pb-[max(0.5rem,env(safe-area-inset-bottom))]")}
    >
      {shown.map((o, i) => {
        const isSelected = o.value === value;
        return (
          <li
            key={String(o.value)}
            id={optionId(i)}
            role="option"
            aria-selected={isSelected}
            onPointerDown={(e) => e.preventDefault()} // keep focus on the button
            onPointerMove={() => active !== i && setActive(i)}
            onClick={() => choose(o)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl px-3 text-left select-none",
              sheet ? "min-h-12 text-base" : "min-h-10 text-sm",
              i === active && "bg-primary/10",
              isSelected ? "font-semibold text-text" : o.danger ? "text-rose-600 dark:text-rose-400" : "text-text",
            )}
          >
            {o.icon && (
              <span className="inline-flex shrink-0 text-muted" aria-hidden="true">
                {o.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 py-1.5">
              <span className="block truncate">{t(o.label)}</span>
              {o.hint && <span className="block truncate text-xs font-normal text-muted">{o.hint}</span>}
            </span>
            <Check className={cn("h-4 w-4 shrink-0 text-primary", !isSelected && "invisible")} aria-hidden="true" />
          </li>
        );
      })}
      {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t("Nothing matches “{q}”.", { q: query.trim() })}</li>}
    </ul>
  );

  const search = searchable && (
    <div className="relative border-b border-border p-1.5">
      <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <input
        ref={searchRef}
        type="text"
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 && shown[active] ? optionId(active) : undefined}
        aria-label={t("Search {what}", { what: t(label).toLowerCase() })}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={t("Type to search…")}
        className="h-10 w-full rounded-xl bg-surface-muted pr-3 pl-9 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />
    </div>
  );

  const panelClasses = "z-[70] flex flex-col overflow-hidden border border-border bg-surface-strong text-text shadow-2xl shadow-black/15";
  const panel =
    open &&
    (sheet
      ? createPortal(
          <div className="fixed inset-0 z-[70] flex items-end bg-black/35 backdrop-blur-[2px]">
            <div ref={panelRef} className={cn(panelClasses, "max-h-[70dvh] w-full rounded-t-3xl")}>
              <span className="mx-auto mt-3 mb-2 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
              <p className="px-5 pb-2 text-sm font-semibold text-muted">{t(label)}</p>
              {search}
              {listbox}
            </div>
          </div>,
          document.body,
        )
      : rect &&
        createPortal(
          <div
            ref={panelRef}
            className={cn(panelClasses, "fixed rounded-2xl")}
            style={placeNear(rect, { width: Math.max(rect.width, searchable ? 260 : 200), maxHeight: 320 })}
          >
            {search}
            {listbox}
          </div>,
          document.body,
        ));

  return (
    <div className={cn(showLabel ? "flex flex-col gap-1.5" : variant === "pill" && "inline-block", className)}>
      {showLabel && (
        <span id={labelId} className="text-sm font-semibold" onClick={() => buttonRef.current?.focus()}>
          {t(label)}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !searchable && active >= 0 && shown[active] ? optionId(active) : undefined}
        aria-labelledby={showLabel ? labelId : undefined}
        aria-label={showLabel ? undefined : t(label)}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex w-full cursor-pointer items-center gap-2 text-left transition",
          "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          variant === "field"
            ? "h-12 rounded-2xl border border-border bg-surface-strong/70 px-4 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
            : cn(
                "rounded-full font-semibold focus-visible:ring-2 focus-visible:ring-primary",
                PILL_SIZES[size],
                !buttonClassName?.includes("bg-") && "bg-surface-muted",
              ),
          open && variant === "field" && "border-primary ring-4 ring-primary/15",
          buttonClassName,
        )}
      >
        {selected?.icon && (
          <span className="inline-flex shrink-0" aria-hidden="true">
            {selected.icon}
          </span>
        )}
        <span className={cn("min-w-0 flex-1 truncate", !selected && variant === "field" && "text-muted")}>
          {selected ? t(selected.label) : (placeholder ?? t("Choose…"))}
        </span>
        <ChevronDown
          className={cn("shrink-0 opacity-70 transition-transform", variant === "field" ? "h-4 w-4" : "h-3.5 w-3.5", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {panel}
    </div>
  );
}
