import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { AlleyLobby } from "@/features/arena/alley/AlleyLobby";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Firecracker Alley") }; // Stage 30: in Nook's language
}

export default function AlleyPage() {
  return <AlleyLobby />;
}
