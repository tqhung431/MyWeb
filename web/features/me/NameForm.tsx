"use client";

// One small form: pick your name (first time) or change it.

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { pickName, renameMe, type User } from "@/lib/api/me";
import { SignInForms } from "./NamePrompt";

import { useT } from "@/lib/i18n/I18nProvider";
type Props = { mode: "pick" | "rename"; initial?: string; onDone: (user: User) => void; autoFocus?: boolean };

export function NameForm(props: Props) {
  // Stage 27: picking a name = the same three ways in as the welcome box (new + PIN, name + PIN, a code)
  if (props.mode === "pick") return <SignInForms onDone={props.onDone} autoFocus={props.autoFocus} />;
  return <RenameForm {...props} />;
}

function RenameForm({ mode, initial = "", onDone, autoFocus }: Props) {
  const t = useT();
  const [name, setName] = useState(initial);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      onDone(mode === "pick" ? await pickName(name) : await renameMe(name));
      if (mode === "rename") setPending(false);
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : t("Can't reach Nook right now. Try again in a moment."));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Input
        label={mode === "pick" ? t("Your name") : t("Name")}
        className="flex-1"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        autoComplete="nickname"
        autoFocus={autoFocus}
        placeholder={t("e.g. Bou, Dad, Bà Ngoại")}
        error={error}
        hint={t("How others on this Nook see you. 30 characters, emoji welcome.")}
      />
      <Button type="submit" variant="primary" className="sm:mt-7" disabled={pending || !name.trim() || name.trim() === initial}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {mode === "pick" ? t("Let's go") : t("Save")}
      </Button>
    </form>
  );
}
