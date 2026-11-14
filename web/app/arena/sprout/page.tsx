import type { Metadata } from "next";
import { SproutHome } from "@/features/arena/sprout/SproutHome";

export const metadata: Metadata = { title: "Mầm Thú" };

export default function SproutPage() {
  return <SproutHome />;
}
