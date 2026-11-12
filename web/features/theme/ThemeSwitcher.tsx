"use client";

// Two looks for the same settings (light/dark mode + colour theme):
//   <ThemeSwitcher />          mode buttons and colour swatches, for the sidebar
//   <ThemeSwitcher compact />  one round button that opens the same choices, for the phone header

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Popover } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import { PALETTES, type PaletteId } from "./palettes";
import { getPalette, getThemePref, setPalette, setThemePref, subscribeTheme, type ThemePref } from "./theme";

import { useT } from "@/lib/i18n/I18nProvider";
import { tx } from "@/lib/i18n/core";
const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "system", label: tx("System"), icon: Monitor },
  { value: "light", label: tx("Light"), icon: Sun },
  { value: "dark", label: tx("Dark"), icon: Moon },
];

// The server can't know your choices, so it renders the defaults; the browser then shows the real ones.
function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribeTheme, getThemePref, () => "system");
}
function usePalette(): PaletteId {
  return useSyncExternalStore(subscribeTheme, getPalette, () => "nook");
}
function useShownTheme(): "light" | "dark" {
  return useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light",
  );
}

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const t = useT();
  if (compact) {
    return (
      <Popover label={t("Theme and colours")} button={<Palette className="h-4 w-4" aria-hidden="true" />}>
        {() => (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold">{t("Light or dark")}</p>
              <ModeSwitch />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">{t("Colours")}</p>
              <PalettePicker />
            </div>
          </div>
        )}
      </Popover>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <ModeSwitch />
      <PalettePicker small />
    </div>
  );
}

export function ModeSwitch() {
  const t = useT();
  const pref = useThemePref();
  const index = OPTIONS.findIndex((o) => o.value === pref);

  return (
    <div role="group" aria-label={t("Theme")} className="relative grid grid-cols-3 rounded-2xl border border-border bg-surface-muted p-1">
      {/* The highlight slides under the chosen option */}
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-surface-strong shadow-sm transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === pref;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setThemePref(value)}
            className={cn(
              "relative z-10 flex cursor-pointer flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            <Icon className={cn("h-4 w-4", active && "text-primary")} aria-hidden="true" />
            {t(label)}
          </button>
        );
      })}
    </div>
  );
}

// Each swatch draws itself in its own palette: data-palette on the element switches the colour tokens.
export function PalettePicker({ small = false }: { small?: boolean }) {
  const t = useT();
  const palette = usePalette();
  const shown = useShownTheme();

  return (
    <div role="radiogroup" aria-label={t("Colour theme")} className={cn("grid gap-1.5", small ? "grid-cols-6" : "grid-cols-3")}>
      {PALETTES.map((p) => {
        const active = p.id === palette;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={small ? t(p.name) : undefined}
            title={`${t(p.name)}: ${t(p.feel)}`}
            onClick={() => setPalette(p.id)}
            className={cn(
              "group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              small ? "p-0.5" : "border p-2",
              !small && (active ? "border-primary bg-primary/8" : "border-border hover:bg-surface-muted"),
            )}
          >
            <span
              data-palette={p.id}
              data-theme={shown}
              className={cn(
                "relative flex items-center justify-center overflow-hidden rounded-full bg-background ring-1 ring-border",
                small ? "h-7 w-7" : "h-10 w-10",
                active && small && "ring-2 ring-text ring-offset-2 ring-offset-surface-strong",
              )}
            >
              <span className="absolute inset-1 rounded-full bg-linear-to-br from-primary to-primary-2" />
              {active && <Check className={cn("relative text-on-primary", small ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={3} aria-hidden="true" />}
            </span>
            {!small && <span className={cn("text-xs font-semibold", active ? "text-text" : "text-muted")}>{t(p.name)}</span>}
          </button>
        );
      })}
    </div>
  );
}
