// /watchlist: WatchList (Stage 12). Header and tabs come from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function WatchListLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="watchlist" />
      {children}
    </>
  );
}
