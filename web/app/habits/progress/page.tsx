import type { Metadata } from "next";
import { Progress } from "@/features/habits/Progress";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Habit progress") };
}

export default function Page() {
  return <Progress />;
}
