import type { Metadata } from "next";
import { ListenLobby } from "@/features/arena/listen/ListenLobby";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Listen Together") };
}

export default function ListenPage() {
  return <ListenLobby />;
}
