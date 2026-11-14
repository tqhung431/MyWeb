"use client";

// Stage 21: the Messages page's two parts. On a phone only one shows at a time:
// the list at /messages, the chat at /messages/<person> (Stage 28: its own app; was /hobby-hub/messages).

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Conversations } from "./Conversations";

export function MessagesShell({ children }: { children: ReactNode }) {
  const inChat = usePathname() !== "/messages";
  return (
    <div className="grid h-[calc(100svh-19rem)] min-h-80 grid-cols-1 gap-6 lg:h-[calc(100svh-12rem)] lg:grid-cols-[20rem_minmax(0,1fr)]">
      <Conversations className={cn(inChat && "hidden lg:flex")} />
      <div className={cn("min-h-0", !inChat && "hidden lg:block")}>{children}</div>
    </div>
  );
}
