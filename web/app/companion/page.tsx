import type { Metadata } from "next";
import { CompanionChat } from "@/features/companion/CompanionChat";
import { getCompanionStatus, type CompanionStatus } from "@/lib/api/companion";

export const metadata: Metadata = { title: "Free-time Companion" };
export const dynamic = "force-dynamic"; // asks the API on every visit (it isn't running while the site is built)

export default async function CompanionPage() {
  // Asked on the server, so the page arrives ready (Stage 19). If the API is slow or down, the browser asks instead.
  const status: CompanionStatus | null = await getCompanionStatus(1500).catch(() => null);
  return <CompanionChat initialStatus={status} />;
}
