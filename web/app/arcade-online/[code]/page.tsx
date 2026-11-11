// "/arcade-online/ABCD": a Quiz Party room.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Room } from "@/features/arcade-online/Room";

type Props = { params: Promise<{ code: string }> };
export const metadata: Metadata = { title: "Quiz Party" };

export default async function RoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <Room code={code} />;
}
