import type { Metadata } from "next";
import { Assets } from "@/features/games/van-lo/ui/Assets";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Cloud Path · assets") };
}

export default function VanLoAssetsPage() {
  return <Assets />;
}
