// "/arena/chess/local": two people, one screen.
import type { Metadata } from "next";
import { ChessLocal } from "@/features/arena/chess/ChessLocal";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Chess") };
}

export default function ChessLocalPage() {
  return <ChessLocal mode="local" />;
}
