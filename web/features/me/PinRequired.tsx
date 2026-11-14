"use client";

// Stage 27: everyone protects their name with a PIN. People who picked a name before Stage 27 (or signed in with a
// claim code from the admin) see this once; it can't be skipped, but it only takes a moment.

import { KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { setPin, type User } from "@/lib/api/me";
import { useT } from "@/lib/i18n/I18nProvider";

const onlyDigits = (s: string) => s.replace(/\D/g, "").slice(0, 6);

export function PinForm({ onDone, submitLabel }: { onDone: (user: User) => void; submitLabel?: string }) {
  const t = useT();
  const [pin, setPinText] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pin !== pin2) return setError(t("The two PINs are different"));
    setPending(true);
    setError("");
    try {
      onDone(await setPin(pin));
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : t("Can't reach Nook right now. Try again in a moment."));
    }
    setPending(false);
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <Input label={t("New PIN")} type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPinText(onlyDigits(e.target.value))} placeholder="••••" hint={t("4 to 6 digits")} />
      <Input label={t("PIN again")} type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(onlyDigits(e.target.value))} placeholder="••••" />
      {error && (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={pending || !/^\d{4,6}$/.test(pin) || !pin2}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitLabel ?? t("Save PIN")}
      </Button>
    </form>
  );
}

export function PinRequired({ user, onDone }: { user: User; onDone: (user: User) => void }) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="pin-title" className="w-full max-w-md animate-pop rounded-3xl border border-border bg-surface-strong p-6 shadow-card sm:p-8">
        <KeyRound className="h-10 w-10 text-primary" aria-hidden="true" />
        <h2 id="pin-title" className="mt-3 text-2xl font-bold tracking-tight">
          {t("Protect your name, {name}", { name: user.name })}
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t("Pick a short PIN. With it you can use your name on another phone or computer, and nobody else can.")}</p>
        <PinForm onDone={onDone} />
      </div>
    </div>
  );
}
