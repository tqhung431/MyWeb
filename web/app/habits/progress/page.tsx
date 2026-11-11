import type { Metadata } from "next";
import { Progress } from "@/features/habits/Progress";

export const metadata: Metadata = { title: "Habit progress" };

export default function Page() {
  return <Progress />;
}
