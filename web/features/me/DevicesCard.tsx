"use client";

// Stage 27: Settings → Your devices. Every browser signed in as you, a code to sign in another one, your PIN,
// and signing out (this browser, or all the others).

import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/Dialog";
import { getDevices, makeDeviceCode, signOut, signOutDevice, type Device } from "@/lib/api/me";
import { useT } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import { useMe } from "./MeProvider";
import { PinForm } from "./PinRequired";

/** "Phone · Safari" from the browser's user agent: enough to recognise it, no more */
export function describeDevice(ua: string): { kind: "phone" | "tablet" | "computer"; label: string } {
  const kind = /iPad|Tablet/i.test(ua) ? "tablet" : /iPhone|Android.+Mobile|Mobile/i.test(ua) ? "phone" : "computer";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return { kind, label: [os, browser].filter(Boolean).join(" · ") };
}

export function DevicesCard() {
  const t = useT();
  const { user, forget } = useMe();
  const confirm = useConfirm();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [changingPin, setChangingPin] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => void getDevices().then(setDevices, () => setDevices([])), []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);
  useEffect(() => {
    if (!code) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [code]);
  if (!user) return null;

  const left = code ? Math.max(0, Math.round((new Date(code.expiresAt).getTime() - now) / 1000)) : 0;
  const kindLabel = { phone: t("Phone"), tablet: t("Tablet"), computer: t("Computer") };

  return (
    <Card id="devices">
      <CardHeader title={t("Your devices")} subtitle={t("Phones and computers signed in as {name}.", { name: user.name })} />
      <ul className="flex flex-col gap-2">
        {devices?.map((d) => {
          const info = describeDevice(d.userAgent);
          const Icon = info.kind === "phone" ? Smartphone : info.kind === "tablet" ? Tablet : Laptop;
          return (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                  {kindLabel[info.kind]}
                  {info.label && <span className="font-normal text-muted"> · {info.label}</span>}
                  {d.current && <span className="ml-2 rounded-full bg-primary/12 px-2 py-0.5 text-xs font-bold text-primary">{t("This one")}</span>}
                </p>
                <p className="text-xs text-muted">{t("Last used {when}", { when: timeAgo(d.lastUsedAt) })}</p>
              </div>
              {!d.current && (
                <Button variant="ghost" size="sm" onClick={() => signOutDevice(d.id).then(load, () => {})}>
                  {t("Sign out")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => makeDeviceCode().then(setCode, () => {})}>
          {t("Sign in another device")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setChangingPin((x) => !x)}>
          {user.hasPin ? t("Change PIN") : t("Set a PIN")}
        </Button>
        {devices && devices.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => signOutDevice("others").then(load, () => {})}>
            {t("Sign out the others")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!(await confirm({ title: t("Sign out of this browser?"), description: t("To come back, use your name and PIN."), confirmLabel: t("Sign out") }))) return;
            await signOut().catch(() => {});
            forget();
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> {t("Sign out")}
        </Button>
      </div>
      {code && left > 0 && (
        <div className="mt-4 rounded-2xl bg-primary/8 p-4 text-center" aria-live="polite">
          <p className="text-sm text-muted">{t("On the other device: Pick a name → I have a code, then type")}</p>
          <p className="my-2 font-mono text-4xl font-extrabold tracking-[0.3em]">{code.code}</p>
          <p className="text-xs text-muted">{t("Works once, for {m}:{s} more", { m: Math.floor(left / 60), s: String(left % 60).padStart(2, "0") })}</p>
        </div>
      )}
      {changingPin && (
        <div className="mt-4 max-w-sm">
          <PinForm
            submitLabel={t("Save PIN")}
            onDone={() => {
              setChangingPin(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2500);
            }}
          />
        </div>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
          {t("PIN saved.")}
        </p>
      )}
    </Card>
  );
}
