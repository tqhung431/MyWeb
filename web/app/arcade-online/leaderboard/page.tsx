import type { Metadata } from "next";
import { QuizBoard } from "@/features/arcade-online/QuizBoard";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Quiz Party leaderboard") };
}

export default function QuizBoardPage() {
  return <QuizBoard />;
}
