import type { Metadata } from "next";
import { GamesHome } from "@/features/games/GamesHome";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Games") };
}

export default function GamesPage() {
  return <GamesHome />;
}
