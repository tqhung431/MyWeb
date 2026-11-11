// /companion: the Free-time Companion (Stage 9). Header comes from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function CompanionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="companion" />
      {children}
    </>
  );
}
