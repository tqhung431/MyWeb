"use client";

// Stage 27: is this browser the admin right now? Asked once per page load (and when your name changes), shared by
// every component that shows admin buttons (Hobby Hub delete, the Admin page link).

import { useEffect, useState } from "react";
import { useMe } from "@/features/me/MeProvider";
import { getAdmin } from "@/lib/api/arena";

let cached: { key: string; value: Promise<boolean> } | null = null;

export function refreshAdmin() {
  cached = null;
}

export function useIsAdmin(): boolean {
  const { user } = useMe();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!user) return setAdmin(false);
    const key = user.id;
    if (!cached || cached.key !== key) cached = { key, value: getAdmin().then((s) => s.isAdmin, () => false) };
    let live = true;
    void cached.value.then((v) => live && setAdmin(v));
    return () => {
      live = false;
    };
  }, [user]);
  return admin;
}
