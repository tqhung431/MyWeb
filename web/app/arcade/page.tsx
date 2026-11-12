import type { Metadata } from "next";
import { Lobby } from "@/features/arcade/Lobby";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Mini Arcade") };
}

export default function ArcadePage() {
  return <Lobby />;
}
