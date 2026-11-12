"use client";

// Stage 21: Settings: language, light or dark, and the colour theme.
// Language is a cookie (the server renders pages in it); light/dark and colours stay in this browser.

import { Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ModeSwitch, PalettePicker } from "@/features/theme/ThemeSwitcher";
import { LANGS } from "@/lib/i18n/core";
import { saveLang, useLang, useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";

export function SettingsPage() {
  const t = useT();
  const lang = useLang();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Settings")}</h1>
        <p className="mt-2 text-muted">{t("Saved on this browser. Each phone or computer can have its own.")}</p>
      </div>

      <Card>
        <CardHeader title={t("Language")} subtitle={t("Menus, buttons and messages. What people write stays as they wrote it.")} />
        <div role="radiogroup" aria-label={t("Language")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LANGS.map((l) => {
            const active = l.id === lang;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={active}
                lang={l.id}
                onClick={() => !active && saveLang(l.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left font-semibold transition",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  active ? "border-primary bg-primary/8" : "border-border hover:bg-surface-muted",
                )}
              >
                <span>
                  <span aria-hidden="true">{l.id === "vi" ? "🇻🇳 " : "🇬🇧 "}</span>
                  {l.label}
                </span>
                {active && <Check className="h-5 w-5 text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title={t("Light or dark")} subtitle={t("System follows your device: dark at night if your phone does that.")} />
        <ModeSwitch />
      </Card>

      <Card>
        <CardHeader title={t("Colours")} subtitle={t("Six colour themes, each with a light and a dark look.")} />
        <PalettePicker />
      </Card>
    </div>
  );
}
