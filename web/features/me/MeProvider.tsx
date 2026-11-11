"use client";

// Who you are, for every client component (sidebar, Hobby Hub, timer settings...).
// Stage 11: you're just a name on this browser. No sign-in, no sign-out.
//
// The root layout asks the API on the server and passes the answer in as initialUser,
// so the very first HTML already shows your name.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "@/lib/api/me";
import { NamePrompt } from "./NamePrompt";

type MeState = {
  user: User | null;
  /** After picking or changing your name */
  setUser: (user: User) => void;
  /** Open the "What should we call you?" box */
  askName: () => void;
  /** After "Delete me" */
  forget: () => void;
};

const MeContext = createContext<MeState | null>(null);
const LATER_KEY = "nook.namePrompt.later"; // sessionStorage: "Not now" lasts until the browser closes

export function MeProvider({ initialUser, children }: { initialUser: User | null; children: ReactNode }) {
  const [user, setUserState] = useState(initialUser);
  const [prompt, setPrompt] = useState(false);
  const router = useRouter();

  // When the server's answer changes (after router.refresh()), follow it.
  useEffect(() => setUserState(initialUser), [initialUser]);

  // First visit: ask for a name (unless "Not now" was pressed in this browser session)
  useEffect(() => {
    if (initialUser) return;
    let later = false;
    try {
      later = sessionStorage.getItem(LATER_KEY) === "1";
    } catch {
      // storage blocked: ask
    }
    if (!later) setPrompt(true);
  }, [initialUser]);

  const setUser = useCallback(
    (u: User) => {
      setUserState(u);
      setPrompt(false);
      router.refresh(); // re-run Server Components with the new cookie / name
    },
    [router],
  );

  const later = useCallback(() => {
    setPrompt(false);
    try {
      sessionStorage.setItem(LATER_KEY, "1");
    } catch {
      // fine
    }
  }, []);

  const forget = useCallback(() => {
    setUserState(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const askName = useCallback(() => setPrompt(true), []);

  const value = useMemo(() => ({ user, setUser, askName, forget }), [user, setUser, askName, forget]);
  return (
    <MeContext.Provider value={value}>
      {children}
      {prompt && !user && <NamePrompt onDone={setUser} onLater={later} />}
    </MeContext.Provider>
  );
}

export function useMe(): MeState {
  const value = useContext(MeContext);
  if (!value) throw new Error("useMe must be used inside <MeProvider>");
  return value;
}
