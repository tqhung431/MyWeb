// "/arena/chess/nook?level=2&color=w": play Nook, the computer.
import type { Metadata } from "next";
import { ChessLocal } from "@/features/arena/chess/ChessLocal";
import type { Level } from "@/features/arena/chess/engine";
import { getT } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ level?: string; color?: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Play Nook") };
}

export default async function ChessNookPage({ searchParams }: Props) {
  const q = await searchParams;
  const level = Math.min(4, Math.max(1, Number(q.level) || 2)) as Level;
  const color = q.color === "b" ? "b" : "w";
  return <ChessLocal key={`${level}${color}`} mode="nook" level={level} color={color} />;
}
