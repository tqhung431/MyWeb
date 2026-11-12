// "/arcade/worm", "/arcade/pairs"…: one game. Only the games in the list exist (others → 404).

import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { GameShell } from "@/features/arcade/GameShell";
import { GAMES, getGame } from "@/features/arcade/games";

type Props = { params: Promise<{ game: string }> };

// Known at build time, so Next.js can prepare every game page in advance
export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getT();
  return { title: t(getGame((await params).game)?.name ?? "Game not found") };
}

export default async function GamePage({ params }: Props) {
  const game = getGame((await params).game);
  if (!game) notFound();
  return <GameShell gameId={game.id} />;
}
