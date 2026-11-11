// Nested layout: wraps every page under /chill (Focus and Tips) with the app's header and tabs.
// Each future app gets the same: app/<app>/layout.tsx with <AppHeader appId="..." />.

import { AppHeader } from "@/components/shell/AppHeader";

export default function ChillLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="chill" />
      {children}
    </>
  );
}
