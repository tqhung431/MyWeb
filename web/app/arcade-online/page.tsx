import type { Metadata } from "next";
import { Lobby } from "@/features/arcade-online/Lobby";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Quiz Party") };
}

export default function ArcadeOnlinePage() {
  return <Lobby />;
}
