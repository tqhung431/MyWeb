// "/arena/alley/ABCD": a Ngõ Pháo room (Stage 23).
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { AlleyRoom } from "@/features/arena/alley/AlleyRoom";

type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Firecracker Alley") }; // Stage 30: in Nook's language
}

export default async function AlleyRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <AlleyRoom code={code} />;
}
