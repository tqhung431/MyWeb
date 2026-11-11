// /hobby-hub: Hobby Hub (Stage 11). Header and tabs come from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function HobbyHubLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="hobby-hub" />
      {children}
    </>
  );
}
