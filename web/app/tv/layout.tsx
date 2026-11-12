// /tv: Nook TV (Stage 22). Uses the game server for the "live now" signal and screen sharing.
import { AppHeader } from "@/components/shell/AppHeader";
import { ArenaProvider } from "@/features/arena/ArenaProvider";

export default function TvLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArenaProvider>
      <AppHeader appId="tv" />
      {children}
    </ArenaProvider>
  );
}
