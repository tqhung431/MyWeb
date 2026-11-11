"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "./AuthProvider";

export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <Button variant="secondary" onClick={signOut}>
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}
