import type { Metadata } from "next";
import { Search } from "@/features/watch/Search";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Find shows and anime") };
}

export default function WatchSearchPage() {
  return <Search />;
}
