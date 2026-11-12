import type { Metadata } from "next";
import { Today } from "@/features/habits/Today";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Habits today") };
}

export default function Page() {
  return <Today />;
}
