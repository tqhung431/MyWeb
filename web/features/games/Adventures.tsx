"use client";

// Stage 30: the Games app's "Adventures" tab: the long games with saves.
import { useT } from "@/lib/i18n/I18nProvider";
import { CloudPathCard, SproutCard, TwoUp } from "./GameCards";

export function Adventures() {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("Long games with saves: they remember where you got to, on this browser and with your name.")}</p>
      <TwoUp>
        <CloudPathCard />
        <SproutCard />
      </TwoUp>
      <div className="rounded-3xl border border-dashed border-border bg-surface/60 p-4">
        <p className="font-semibold">🤝 {t("Coming next: Sproutlings with friends")}</p>
        <p className="text-sm text-muted">{t("Battle and swap sproutlings with other people, 18 more sproutlings, your own garden.")}</p>
      </div>
    </div>
  );
}
