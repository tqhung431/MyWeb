import type { Metadata } from "next";
import { Lobby } from "@/features/arcade/Lobby";

export const metadata: Metadata = { title: "Mini Arcade" };

export default function ArcadePage() {
  return <Lobby />;
}
