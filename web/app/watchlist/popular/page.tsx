import type { Metadata } from "next";
import { OnNook } from "@/features/watch/OnNook";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Watched on Nook") };
}

export default function WatchPopularPage() {
  return <OnNook />;
}
