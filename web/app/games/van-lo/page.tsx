import type { Metadata } from "next";
import { VanLo } from "@/features/games/van-lo/ui/VanLo";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Vân Lộ") };
}

export default function VanLoPage() {
  return <VanLo />;
}
