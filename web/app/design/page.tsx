import type { Metadata } from "next";
import { Gallery } from "@/features/design/Gallery";

export const metadata: Metadata = { title: "Design system" };

// Stage 15: every shared component, in every state, in the current theme.
export default function DesignPage() {
  return <Gallery />;
}
