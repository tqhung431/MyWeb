import type { Metadata } from "next";
import { ChessLobby } from "@/features/arena/chess/ChessLobby";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Chess") };
}

export default function ChessPage() {
  return <ChessLobby />;
}
