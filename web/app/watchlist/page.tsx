import type { Metadata } from "next";
import { MyList } from "@/features/watch/MyList";

export const metadata: Metadata = { title: "My WatchList" };

export default function WatchListPage() {
  return <MyList />;
}
