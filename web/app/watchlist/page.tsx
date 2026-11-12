import type { Metadata } from "next";
import { MyList } from "@/features/watch/MyList";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("My WatchList") };
}

export default function WatchListPage() {
  return <MyList />;
}
