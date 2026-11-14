// /games/adventures (Stage 30): the long games with saves, Cloud Path and Sproutlings.
import type { Metadata } from "next";
import { Adventures } from "@/features/games/Adventures";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Adventures") };
}

export default function AdventuresPage() {
  return <Adventures />;
}
