// /arcade: Mini Arcade (Stage 10). Header and tabs come from the app registry.
import { ArcadeHeader } from "@/features/arcade/ArcadeHeader";

export default function ArcadeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ArcadeHeader />
      {children}
    </>
  );
}
