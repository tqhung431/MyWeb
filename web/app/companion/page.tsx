import type { Metadata } from "next";
import { CompanionChat } from "@/features/companion/CompanionChat";

export const metadata: Metadata = { title: "Free-time Companion" };

export default function CompanionPage() {
  return <CompanionChat />;
}
