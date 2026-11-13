// "/arena/village/solo?map=riverside[&endless=1]" or "?continue=1": Giữ Làng alone, in your browser (Stage 24).
import type { Metadata } from "next";
import { VillageSolo } from "@/features/arena/village/VillageSolo";
import { MAP_IDS, type MapId } from "@/features/arena/village/village";

type Props = { searchParams: Promise<{ map?: string; endless?: string; continue?: string }> };
export const metadata: Metadata = { title: "Giữ Làng" };

export default async function VillageSoloPage({ searchParams }: Props) {
  const q = await searchParams;
  const map = (MAP_IDS as string[]).includes(q.map ?? "") ? (q.map as MapId) : "riverside";
  return <VillageSolo key={`${map}${q.endless}${q.continue}`} map={map} endless={q.endless === "1"} resume={q.continue === "1"} />;
}
