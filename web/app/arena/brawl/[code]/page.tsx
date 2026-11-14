// "/arena/brawl/ABCD": a Chợ Đêm Brawl room (Stage 25).
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { BrawlRoom } from "@/features/arena/brawl/BrawlRoom";

type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Night Market Brawl") }; // Stage 30: in Nook's language
}

export default async function BrawlRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <BrawlRoom code={code} />;
}
