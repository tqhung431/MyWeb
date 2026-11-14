// "/arena/village/solo?map=riverside[&endless=1]" or "?continue=1": Giữ Làng alone, in your browser (Stage 24).
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { VillageSolo } from "@/features/arena/village/VillageSolo";
import { MAP_IDS, type MapId } from "@/features/arena/village/village";

type Props = { searchParams: Promise<{ map?: string; endless?: string; continue?: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Keep the Village") }; // Stage 30: in Nook's language
}

export default async function VillageSoloPage({ searchParams }: Props) {
  const q = await searchParams;
  const map = (MAP_IDS as string[]).includes(q.map ?? "") ? (q.map as MapId) : "riverside";
  return <VillageSolo key={`${map}${q.endless}${q.continue}`} map={map} endless={q.endless === "1"} resume={q.continue === "1"} />;
}
