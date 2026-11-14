import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { BrawlLobby } from "@/features/arena/brawl/BrawlLobby";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Night Market Brawl") }; // Stage 30: in Nook's language
}

export default function BrawlPage() {
  return <BrawlLobby />;
}
