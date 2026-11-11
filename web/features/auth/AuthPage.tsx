// Shared frame for /login and /register: a welcome panel and the form.

import { CloudSun, Laptop, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

const PERKS = [
  { icon: Laptop, text: "Your focus history follows you to any device" },
  { icon: CloudSun, text: "Sessions you finished before signing up are kept" },
  { icon: ShieldCheck, text: "Passwords are stored as one-way hashes, never as text" },
];

export function AuthPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-12">
      <section className="hidden lg:block">
        <h1 className="text-4xl leading-tight font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-lg text-muted">{subtitle}</p>
        <ul className="mt-8 flex flex-col gap-4">
          {PERKS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      <Card className="w-full p-6 sm:p-8">
        <div className="mb-6 lg:hidden">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

// Turns ?error=github_state into a sentence people understand.
export function githubErrorMessage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const messages: Record<string, string> = {
    github_off: "GitHub sign-in isn't set up on this server yet.",
    github_expired: "The GitHub sign-in took too long. Please try again.",
    github_state: "That GitHub sign-in link wasn't started here. Please try again.",
    github_token: "GitHub didn't confirm the sign-in. Please try again.",
    github_email: "Your GitHub account needs a verified email address.",
    github_failed: "We couldn't reach GitHub. Please try again in a moment.",
  };
  return messages[code] ?? "Sign-in failed. Please try again.";
}

// Only allow our own pages as the "go back to" target.
export function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && /^\/(?!\/)/.test(value) ? value : "/";
}
