"use client";

// The arcade's header. While you play a game on a phone, it's hidden: the board needs the room.
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/AppHeader";

export function ArcadeHeader() {
  const pathname = usePathname();
  const inGame = pathname.startsWith("/arcade/") && pathname !== "/arcade/scores";
  return <AppHeader appId="arcade" className={inGame ? "hidden sm:flex" : undefined} />;
}
