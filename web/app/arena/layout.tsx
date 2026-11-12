// /arena: Nook Arena (Stage 22). Header and tabs come from the app registry; the game server connection
// is opened only inside this app.
import { AppHeader } from "@/components/shell/AppHeader";
import { ArenaProvider } from "@/features/arena/ArenaProvider";

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <ArenaProvider>
      <AppHeader appId="arena" />
      {children}
    </ArenaProvider>
  );
}
