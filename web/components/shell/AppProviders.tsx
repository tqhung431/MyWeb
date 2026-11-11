"use client";

// Every app-wide provider, in one place. Order matters: inner providers can use outer ones
// (FocusProvider reads the signed-in user to reload your sessions after login/logout).

import type { ReactNode } from "react";
import { AmbientProvider } from "@/features/ambient/AmbientProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { FocusProvider } from "@/features/focus/FocusProvider";
import type { User } from "@/lib/api/auth";

export function AppProviders({ initialUser, children }: { initialUser: User | null; children: ReactNode }) {
  return (
    <AuthProvider initialUser={initialUser}>
      <AmbientProvider>
        <FocusProvider>{children}</FocusProvider>
      </AmbientProvider>
    </AuthProvider>
  );
}
