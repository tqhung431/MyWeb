// /habits: Habit & Reading Tracker (Stage 13). Header and tabs come from the app registry.
import { AppHeader } from "@/components/shell/AppHeader";

export default function HabitsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="habits" />
      {children}
    </>
  );
}
