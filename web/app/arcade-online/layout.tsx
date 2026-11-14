// /arcade-online: Arcade Online (Stage 14). Header and tabs come from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function ArcadeOnlineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="games" /> {/* Stage 30: the Games app's "Party" tab */}
      {children}
    </>
  );
}
