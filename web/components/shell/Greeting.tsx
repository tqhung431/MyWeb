"use client";

// "Good morning / afternoon / evening" in the visitor's own time.
// The server doesn't know their clock, so it renders a neutral greeting first,
// then the browser swaps it in after loading (avoids a hydration mismatch).

import { useEffect, useState } from "react";

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  const [text, setText] = useState("Welcome back");

  useEffect(() => {
    setText(greetingFor(new Date().getHours()));
  }, []);

  return (
    <h1 className="bg-linear-to-r from-text via-primary to-primary-2 bg-clip-text pb-1 text-4xl leading-[1.15] font-bold tracking-tight text-transparent sm:text-5xl">
      {text}.
    </h1>
  );
}
