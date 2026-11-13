import type { Metadata } from "next";
import { VillageLobby } from "@/features/arena/village/VillageLobby";

export const metadata: Metadata = { title: "Giữ Làng" };

export default function VillagePage() {
  return <VillageLobby />;
}
