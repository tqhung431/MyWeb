import type { Metadata } from "next";
import { BrawlLobby } from "@/features/arena/brawl/BrawlLobby";

export const metadata: Metadata = { title: "Chợ Đêm Brawl" };

export default function BrawlPage() {
  return <BrawlLobby />;
}
