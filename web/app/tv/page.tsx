import type { Metadata } from "next";
import { TvPage } from "@/features/tv/TvPage";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Nook TV") };
}

export default function TvRoute() {
  return <TvPage />;
}
