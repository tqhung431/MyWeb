// /games/leaderboards (Stage 30): every game's leaderboard in one place.
import type { Metadata } from "next";
import { Leaderboards } from "@/features/games/Leaderboards";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Leaderboards") };
}

export default function LeaderboardsPage() {
  return <Leaderboards />;
}
