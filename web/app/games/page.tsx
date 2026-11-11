import type { Metadata } from "next";
import { GamesHome } from "@/features/games/GamesHome";

export const metadata: Metadata = { title: "Nook Games" };

export default function GamesPage() {
  return <GamesHome />;
}
