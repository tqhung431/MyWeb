"use client";

// One form for both "Sign in" and "Create account".

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "./AuthProvider";

type Props = { mode: "login" | "register"; next: string };

type FieldErrors = Partial<Record<"name" | "email" | "password", string>>;

export function AuthForm({ mode, next }: Props) {
  const router = useRouter();
  const { signedIn } = useAuth();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    setPending(true);
    setError("");
    setFieldErrors({});
    try {
      const user = isRegister
        ? await register({ name: String(form.get("name") ?? ""), email, password })
        : await login({ email, password });
      signedIn(user);
      router.replace(next);
    } catch (e) {
      if (e instanceof ApiError && e.details.length) {
        // Zod errors from the API → show each one under its field
        setFieldErrors(Object.fromEntries(e.details.map((d) => [d.path, d.message])));
      } else if (e instanceof ApiError) {
        setError(e.message); // "Wrong email or password", "Too many attempts..."
      } else {
        setError("Can't reach the server. Is the API running?");
      }
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {isRegister && (
          <Input label="Name" name="name" autoComplete="name" required maxLength={60} error={fieldErrors.name} />
        )}
        <Input
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          error={fieldErrors.email}
        />
        <Input
          label="Password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={isRegister ? "new-password" : "current-password"}
          required
          minLength={isRegister ? 8 : undefined}
          hint={isRegister ? "At least 8 characters. A short sentence is easy to remember." : undefined}
          error={fieldErrors.password}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-surface-muted hover:text-text"
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          }
        />

        {error && (
          <p role="alert" className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-2 w-full">
          {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
          {isRegister ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        {isRegister ? "Already have an account? " : "New here? "}
        <Link
          href={`${isRegister ? "/login" : "/register"}?next=${encodeURIComponent(next)}`}
          className="font-semibold text-primary hover:underline"
        >
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
