"use client";

// /games: the Games app's front page (Stage 30). Every game once: adventures with saves, live games with friends,
// the party quiz and the quick games. Each section's own tab has more (leaderboards, lobbies, rules).

import { useT } from "@/lib/i18n/I18nProvider";
import { AlleyCard, BrawlCard, ChessCard, CloudPathCard, Grid, QuickGames, QuizCard, Section, SproutCard, TwoUp, VillageCard } from "./GameCards";

export function GamesHome() {
  const t = useT();
  return (
    <div className="flex flex-col gap-8">
      <Section title={t("Adventures")} href="/games/adventures" more={t("More")}>
        <TwoUp>
          <CloudPathCard />
          <SproutCard />
        </TwoUp>
      </Section>
      <Section title={t("Together, live")} href="/arena" more={t("Game server status")}>
        <Grid>
          <AlleyCard />
          <VillageCard />
          <BrawlCard />
          <ChessCard />
        </Grid>
      </Section>
      <Section title={t("Party")} href="/arcade-online" more={t("Rooms")}>
        <TwoUp>
          <QuizCard />
        </TwoUp>
      </Section>
      <Section title={t("Quick games")} href="/games/leaderboards" more={t("Leaderboards")}>
        <QuickGames />
      </Section>
    </div>
  );
}
