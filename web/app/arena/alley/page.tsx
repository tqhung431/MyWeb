import type { Metadata } from "next";
import { AlleyLobby } from "@/features/arena/alley/AlleyLobby";

export const metadata: Metadata = { title: "Ngõ Pháo" };

export default function AlleyPage() {
  return <AlleyLobby />;
}
