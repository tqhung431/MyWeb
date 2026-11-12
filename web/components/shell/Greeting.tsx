"use client";

// "Good morning / afternoon / evening" in the visitor's own time.
// The server doesn't know their clock, so it renders a neutral greeting first,
// then the browser swaps it in after loading (avoids a hydration mismatch).

import type { T } from "@/lib/i18n/core";
import { useEffect, useState } from "react";

import { useT } from "@/lib/i18n/I18nProvider";
function greetingFor(hour: number, t: T): string {
  if (hour < 5) return t("Good night");
  if (hour < 12) return t("Good morning");
  if (hour < 18) return t("Good afternoon");
  return t("Good evening");
}

export function Greeting() {
  const t = useT();
  const [text, setText] = useState(t("Welcome back"));

  useEffect(() => {
    setText(greetingFor(new Date().getHours(), t));
  }, [t]);

  return (
    <h1 className="bg-linear-to-r from-text via-primary to-primary-2 bg-clip-text pb-1 text-4xl leading-[1.15] font-bold tracking-tight text-transparent sm:text-5xl">
      {text}.
    </h1>
  );
}
