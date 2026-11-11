"use client";

// One small form: pick your name (first time) or change it.

import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import { pickName, renameMe, type User } from "@/lib/api/me";

type Props = { mode: "pick" | "rename"; initial?: string; onDone: (user: User) => void; autoFocus?: boolean };

export function NameForm({ mode, initial = "", onDone, autoFocus }: Props) {
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
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Can't reach Nook right now. Try again in a moment.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Input
        label={mode === "pick" ? "Your name" : "Name"}
        className="flex-1"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        autoComplete="nickname"
        autoFocus={autoFocus}
        placeholder="e.g. Linh, Dad, Bà Ngoại"
        error={error}
        hint="How others on this Nook see you. 30 characters, emoji welcome."
      />
      <Button type="submit" variant="primary" className="sm:mt-7" disabled={pending || !name.trim() || name.trim() === initial}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {mode === "pick" ? "Let's go" : "Save"}
      </Button>
    </form>
  );
}
