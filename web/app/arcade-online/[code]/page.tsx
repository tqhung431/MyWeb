// "/arcade-online/ABCD": a Quiz Party room.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Room } from "@/features/arcade-online/Room";

import { getT } from "@/lib/i18n/server";
type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Quiz Party") };
}

export default async function RoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <Room code={code} />;
}
