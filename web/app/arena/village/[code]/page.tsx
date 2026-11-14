// "/arena/village/ABCD": a Giữ Làng co-op room (Stage 24).
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { VillageRoom } from "@/features/arena/village/VillageRoom";

type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Keep the Village") }; // Stage 30: in Nook's language
}

export default async function VillageRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <VillageRoom code={code} />;
}
