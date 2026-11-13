// "/arena/chess/game/12": replay a finished game.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChessReplay } from "@/features/arena/chess/ChessReplay";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Replay") };
}

export default async function ChessReplayPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <ChessReplay id={id} />;
}
