import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { VillageLobby } from "@/features/arena/village/VillageLobby";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Keep the Village") }; // Stage 30: in Nook's language
}

export default function VillagePage() {
  return <VillageLobby />;
}
