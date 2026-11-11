// Shared frame for /login and /register: a welcome panel and the form.

import { Laptop, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

const PERKS = [
  { icon: UserRoundCheck, text: "Optional: everything works as a guest too" },
  { icon: Laptop, text: "Your focus history follows you to any PC or phone" },
  { icon: ShieldCheck, text: "Sessions you did as a guest move into your account" },
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

// Only allow our own pages as the "go back to" target.
export function safeNext(value: string | string[] | undefined): string {
  return typeof value === "string" && /^\/(?!\/)/.test(value) ? value : "/";
}
