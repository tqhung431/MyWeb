import type { Metadata } from "next";
import { Search } from "@/features/watch/Search";

export const metadata: Metadata = { title: "Find shows and anime" };

export default function WatchSearchPage() {
  return <Search />;
}
