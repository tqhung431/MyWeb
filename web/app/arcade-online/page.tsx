import type { Metadata } from "next";
import { Lobby } from "@/features/arcade-online/Lobby";

export const metadata: Metadata = { title: "Quiz Party" };

export default function ArcadeOnlinePage() {
  return <Lobby />;
}
