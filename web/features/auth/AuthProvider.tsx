"use client";

// Who is signed in, for every client component (sidebar, mini player, forms...).
//
// The root layout asks the API on the server and passes the answer in as initialUser,
// so the very first HTML already shows your name: no "signed out" flash.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { logout, type User } from "@/lib/api/auth";

type AuthState = {
  user: User | null;
  signedIn: (user: User) => void; // call after login/register succeeded
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ initialUser, children }: { initialUser: User | null; children: ReactNode }) {
  const [user, setUser] = useState(initialUser);
  const router = useRouter();

  // When the server's answer changes (after router.refresh(), or an expired session), follow it.
  useEffect(() => setUser(initialUser), [initialUser]);

  const signedIn = useCallback(
    (u: User) => {
      setUser(u);
      router.refresh(); // re-run Server Components with the new cookie
    },
    [router],
  );

  const signOut = useCallback(async () => {
    await logout().catch(() => {}); // even if the API is down, forget the user here
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = useMemo(() => ({ user, signedIn, signOut }), [user, signedIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
