// "/arena/listen/ABCD": a Listen Together room.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListenRoom } from "@/features/arena/listen/ListenRoom";
import { getT } from "@/lib/i18n/server";

type Props = { params: Promise<{ code: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Listen Together") };
}

export default async function ListenRoomPage({ params }: Props) {
  const code = (await params).code.toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) notFound();
  return <ListenRoom code={code} />;
}
