import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SproutHome } from "@/features/arena/sprout/SproutHome";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Sproutlings") }; // Stage 30: in Nook's language
}

export default function SproutPage() {
  return <SproutHome />;
}
