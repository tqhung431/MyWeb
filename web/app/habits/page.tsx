import type { Metadata } from "next";
import { Today } from "@/features/habits/Today";

export const metadata: Metadata = { title: "Habits today" };

export default function Page() {
  return <Today />;
}
