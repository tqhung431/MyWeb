"use client";

// Every app-wide provider, in one place. A future app that needs global state
// (for example a game score or a login session in Stage 4) adds its provider here.

import type { ReactNode } from "react";
import { AmbientProvider } from "@/features/ambient/AmbientProvider";
import { FocusProvider } from "@/features/focus/FocusProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AmbientProvider>
      <FocusProvider>{children}</FocusProvider>
    </AmbientProvider>
  );
}
