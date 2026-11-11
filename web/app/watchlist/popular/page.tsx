import type { Metadata } from "next";
import { OnNook } from "@/features/watch/OnNook";

export const metadata: Metadata = { title: "Watched on Nook" };

export default function WatchPopularPage() {
  return <OnNook />;
}
