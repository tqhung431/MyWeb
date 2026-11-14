"use client";

// "What should we call you?": shown on your first visit. Stage 27: three ways in.
//   New here     → a name and a PIN (the PIN gets your name back on another phone or computer)
//   I have a name → your name and PIN
//   I have a code → a code from your other device (Settings → Devices) or from the admin
// "Not now" hides it until the browser is closed; Hobby Hub and the You page ask again when needed.

import { Loader2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ApiError } from "@/lib/api/client";
import { pickName, signIn, signInWithCode, type User } from "@/lib/api/me";
import { useT } from "@/lib/i18n/I18nProvider";

type Mode = "new" | "name" | "code";
const onlyDigits = (s: string) => s.replace(/\D/g, "").slice(0, 6);

export function SignInForms({ onDone, autoFocus, initialMode = "new" }: { onDone: (user: User) => void; autoFocus?: boolean; initialMode?: Mode }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [pin, setPinText] = useState("");
  const [pin2, setPin2] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "new" && pin !== pin2) return setError(t("The two PINs are different"));
    setPending(true);
    try {
      const user = mode === "new" ? await pickName(name, pin) : mode === "name" ? await signIn(name, pin) : await signInWithCode(code);
      onDone(user);
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : t("Can't reach Nook right now. Try again in a moment."));
      setPending(false);
    }
  }
  const pinOk = /^\d{4,6}$/.test(pin);
  const ready = mode === "code" ? code.replace(/\W/g, "").length >= 6 : name.trim() && pinOk && (mode === "name" || pin2.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label="How do you want to come in?"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setError("");
        }}
        options={[
          { value: "new", label: "New here" },
          { value: "name", label: "I have a name" },
          { value: "code", label: "I have a code" },
        ]}
      />
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        {mode !== "code" && (
          <Input
            label={mode === "new" ? t("Your name") : t("Name")}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            autoComplete={mode === "new" ? "nickname" : "username"}
            autoFocus={autoFocus}
            placeholder={t("e.g. Bou, Dad, Bà Ngoại")}
            hint={mode === "new" ? t("How others on this Nook see you. 30 characters, emoji welcome.") : undefined}
          />
        )}
        {mode !== "code" && (
          <Input
            label={t("PIN")}
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete={mode === "new" ? "new-password" : "current-password"}
            value={pin}
            onChange={(e) => setPinText(onlyDigits(e.target.value))}
            placeholder="••••"
            hint={mode === "new" ? t("4 to 6 digits. With it, you can use your name on another phone or computer.") : undefined}
          />
        )}
        {mode === "new" && (
          <Input label={t("PIN again")} name="pin2" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(onlyDigits(e.target.value))} placeholder="••••" />
        )}
        {mode === "code" && (
          <Input
            label={t("Sign-in code")}
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            autoFocus={autoFocus}
            placeholder="ABC123"
            hint={t("Open Settings → Devices on a phone or computer that's already you, or ask the admin.")}
          />
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={pending || !ready}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {mode === "new" ? t("Let's go") : t("Sign in")}
        </Button>
      </form>
    </div>
  );
}

export function NamePrompt({ onDone, onLater }: { onDone: (user: User) => void; onLater: () => void }) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onLater();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onLater]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-prompt-title"
        className="relative max-h-[92dvh] w-full max-w-md animate-pop overflow-y-auto rounded-3xl border border-border bg-surface-strong p-6 shadow-card sm:p-8"
      >
        <Button variant="ghost" size="icon" className="absolute top-3 right-3 h-9 w-9" onClick={onLater} aria-label={t("Not now")}>
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
        <p className="text-5xl" aria-hidden="true">
          👋
        </p>
        <h2 id="name-prompt-title" className="mt-3 text-2xl font-bold tracking-tight">
          {t("What should we call you?")}
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted">{t("A name and a short PIN, so everyone here knows who's who. No email, no password.")}</p>
        <SignInForms onDone={onDone} autoFocus />
        <button type="button" onClick={onLater} className="mt-4 cursor-pointer text-sm font-semibold text-muted hover:text-text">
          {t("Not now")}
        </button>
      </div>
    </div>
  );
}
