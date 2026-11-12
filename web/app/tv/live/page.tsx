import type { Metadata } from "next";
import { TvLive } from "@/features/tv/TvLive";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Live") };
}

export default function TvLiveRoute() {
  return <TvLive />;
}
