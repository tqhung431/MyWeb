import type { Metadata } from "next";
import { VanLo } from "@/features/games/van-lo/ui/VanLo";

export const metadata: Metadata = { title: "Vân Lộ" };

export default function VanLoPage() {
  return <VanLo />;
}
