import type { Metadata } from "next";
import { Charts } from "@/features/music/Charts";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Music charts") };
}

export default function MusicPage() {
  return <Charts />;
}
