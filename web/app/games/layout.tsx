"use client";

// /games: Nook Games (Stage 16). While you play on a phone the app header is hidden: the map needs the room.
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/AppHeader";

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  const inGame = usePathname() !== "/games";
  return (
    <>
      <AppHeader appId="games" className={inGame ? "hidden sm:flex" : undefined} />
      {children}
    </>
  );
}
