// /music: the Music app (Stage 7). Header and tabs come from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="music" />
      {children}
    </>
  );
}
