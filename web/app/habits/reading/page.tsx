import type { Metadata } from "next";
import { Reading } from "@/features/habits/Reading";

export const metadata: Metadata = { title: "Reading" };

export default function Page() {
  return <Reading />;
}
