import type { Metadata } from "next";
import { QuizBoard } from "@/features/arcade-online/QuizBoard";

export const metadata: Metadata = { title: "Quiz Party leaderboard" };

export default function QuizBoardPage() {
  return <QuizBoard />;
}
