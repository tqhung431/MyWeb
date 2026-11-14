"use client";

// /games: the Games app (Stage 16 Nook Games; Stage 30 every game). While you play Cloud Path on a phone the app
// header is hidden: the map needs the room.
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/AppHeader";

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  const inGame = usePathname().startsWith("/games/van-lo");
  return (
    <>
      <AppHeader appId="games" className={inGame ? "hidden sm:flex" : undefined} />
      {children}
    </>
  );
}
