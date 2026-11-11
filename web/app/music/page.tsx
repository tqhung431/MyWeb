import type { Metadata } from "next";
import { Charts } from "@/features/music/Charts";

export const metadata: Metadata = { title: "Music charts" };

export default function MusicPage() {
  return <Charts />;
}
