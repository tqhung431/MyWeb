"use client";

// Stage 21: Settings: language, light or dark, and the colour theme. Stage 22: the admin passcode.
// Language is a cookie (the server renders pages in it); light/dark and colours stay in this browser.

import { Check, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ModeSwitch, PalettePicker } from "@/features/theme/ThemeSwitcher";
import { LANGS } from "@/lib/i18n/core";
import { saveLang, useLang, useT } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { useMe } from "@/features/me/MeProvider";
import { becomeAdmin, getAdmin, stopAdmin, type AdminStatus } from "@/lib/api/arena";
import { savePreferences } from "@/lib/api/me";
import { DevicesCard } from "@/features/me/DevicesCard";
import { refreshAdmin } from "@/features/admin/useIsAdmin";
import { ApiError } from "@/lib/api/client";

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
                <span className="flex items-center gap-2.5">
                  {/* Stage 28: a language code, not a flag (Windows shows flags as "GB"/"VN", and a flag is a country) */}
                  <span aria-hidden="true" className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-bold tracking-wide text-muted">
                    {l.id.toUpperCase()}
                  </span>
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

      <PrivacyCard />
      <DevicesCard />
      <AdminCard />
    </div>
  );
}

// Stage 28: what others see. The live feed shows only what people do together; milestones are opt-in.
function PrivacyCard() {
  const t = useT();
  const { user, setUser } = useMe();
  const [saving, setSaving] = useState(false);
  if (!user) return null;
  const on = !!user.preferences?.shareMilestones;
  async function toggle() {
    setSaving(true);
    try {
      setUser(await savePreferences({ shareMilestones: !on }));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader title={t("Privacy")} subtitle={t("What others on this Nook see about you.")} />
      <ul className="mb-4 flex flex-col gap-1.5 text-sm">
        <li className="flex gap-2">
          <Eye className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{t("Everyone sees: when you join Nook or a group, your group posts, game wins and songs you add.")}</span>
        </li>
        <li className="flex gap-2">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <span>{t("Only you see: focus sessions, habits, reading, what you watch and what you listen to.")}</span>
        </li>
      </ul>
      <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-border p-3 hover:bg-surface-muted">
        <span>
          <span className="block font-semibold">{t("Share my milestones")}</span>
          <span className="block text-sm text-muted">{t("Badges, habit streaks (7, 30, 100 days) and finished books appear in Live now.")}</span>
        </span>
        <input type="checkbox" role="switch" checked={on} disabled={saving} onChange={() => void toggle()} className="peer sr-only" />
        <span
          aria-hidden="true"
          className={cn(
            "relative mt-1 h-6 w-11 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary",
            on ? "bg-primary" : "bg-surface-muted ring-1 ring-border",
          )}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-5.5" : "left-0.5")} />
        </span>
      </label>
    </Card>
  );
}

// Stage 22: Nook's admin (chooses what's on Nook TV, can share a screen). Shown only when the owner set
// ADMIN_PASSCODE in .env. Being admin is remembered on this browser only.
function AdminCard() {
  const t = useT();
  const { user } = useMe();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    getAdmin().then(setStatus, () => {});
  }, [user?.id]);
  if (!status) return null;
  if (!status.enabled) {
    // Stage 27: say why there's no admin (no commands here: the docs explain the fix)
    return status.problem === "short" ? (
      <Card id="admin">
        <CardHeader title={t("Admin")} />
        <p className="text-sm text-muted">{t("Admin is switched off: the admin passcode is too short. It needs 16 characters or more (see docs/stage-27.md).")}</p>
      </Card>
    ) : null;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setStatus(await becomeAdmin(passcode));
      refreshAdmin();
      setPasscode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("That didn't work"));
    }
    setBusy(false);
  };

  return (
    <Card id="admin">
      <CardHeader title={t("Admin")} subtitle={t("The admin looks after Nook: people, Hobby Hub, reports, Nook TV and the banner.")} />
      {status.isAdmin ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex flex-1 items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-500" aria-hidden="true" /> {t("You're the admin on this browser for 12 hours.")}
          </p>
          <Link href="/admin" className={buttonClasses("primary", "sm")}>
            {t("Open the Admin page")}
          </Link>
          <Button variant="secondary" size="sm" onClick={() => stopAdmin().then((s) => (refreshAdmin(), setStatus(s)), () => {})}>
            {t("Stop being admin")}
          </Button>
        </div>
      ) : status.problem === "https" ? (
        <p className="text-sm text-muted">{t("To keep the passcode safe, become admin over https: on the Nook PC (https://localhost), through Tailscale or through the tunnel.")}</p>
      ) : !user ? (
        <p className="text-sm text-muted">{t("Pick a name first (top right), then enter the passcode.")}</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder={t("Admin passcode")}
            aria-label={t("Admin passcode")}
            autoComplete="off"
            className="h-11 min-w-0 flex-1 rounded-2xl border border-border bg-surface-strong/70 px-3 focus:border-primary focus:outline-none"
          />
          <Button type="submit" variant="primary" disabled={!passcode || busy}>
            {t("Become admin")}
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </Card>
  );
}
