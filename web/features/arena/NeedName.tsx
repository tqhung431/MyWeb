"use client";

// Stage 22: "pick a name first" for Nook Arena (playing needs a name so others know who they play).
import { NameForm } from "@/features/me/NameForm";
import { useMe } from "@/features/me/MeProvider";
import { useT } from "@/lib/i18n/I18nProvider";

export function NeedName({ why }: { why: string }) {
  const t = useT();
  const { setUser } = useMe();
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold">{t("Pick a name to play")}</h2>
      <p className="mt-1 mb-4 text-sm text-muted">{why}</p>
      <NameForm mode="pick" onDone={setUser} />
    </div>
  );
}
