// "/arena/chess/ABCD": a live chess room.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChessRoom } from "@/features/arena/chess/ChessRoom";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Chess") };
}

export default async function ChessRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <ChessRoom code={code} />;
}
