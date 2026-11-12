import type { Metadata } from "next";
import { Assets } from "@/features/games/van-lo/ui/Assets";

export const metadata: Metadata = { title: "Vân Lộ · assets" };

export default function VanLoAssetsPage() {
  return <Assets />;
}
