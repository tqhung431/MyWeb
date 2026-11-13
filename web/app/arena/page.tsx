import type { Metadata } from "next";
import { ArenaHub } from "@/features/arena/ArenaHub";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Nook Arena") };
}

export default function ArenaPage() {
  return <ArenaHub />;
}
