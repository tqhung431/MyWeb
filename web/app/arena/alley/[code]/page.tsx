// "/arena/alley/ABCD": a Ngõ Pháo room (Stage 23).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlleyRoom } from "@/features/arena/alley/AlleyRoom";

type Props = { params: Promise<{ code: string }> };
export const metadata: Metadata = { title: "Ngõ Pháo" };

export default async function AlleyRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <AlleyRoom code={code} />;
}
