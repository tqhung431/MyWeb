// "/chill" — Chill Corner. A Server Component that arranges client feature panels,
// plus one tip fetched on the server. If the API is down, the tip is simply left out.

import type { Metadata } from "next";
import { AchievementsCard } from "@/features/achievements/AchievementsCard";
import { SoundPanel } from "@/features/ambient/SoundPanel";
import { FocusPanel } from "@/features/focus/FocusPanel";
import { WeekChart } from "@/features/focus/WeekChart";
import { TipCard } from "@/features/tips/TipCard";
import { getTips, type TipSummary } from "@/lib/api/tips";

export const metadata: Metadata = { title: "Chill Corner" };

async function randomTip(): Promise<TipSummary | null> {
  try {
    const tips = await getTips();
    return tips[Math.floor(Math.random() * tips.length)] ?? null;
  } catch {
    return null; // API down: the page still works without a tip
  }
}

export default async function ChillPage() {
  const tip = await randomTip();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-6">
      <div className="lg:row-span-2">
        <FocusPanel />
      </div>
      <WeekChart />
      <AchievementsCard />
      <div className="lg:col-span-2">
        <SoundPanel />
      </div>
      {tip && (
        <div className="lg:col-span-2">
          <TipCard tip={tip} eyebrow="Tip for this session" />
        </div>
      )}
    </div>
  );
}
