import type { Metadata } from "next";
import { GroupsList } from "@/features/hobby/GroupsList";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Hobby Hub") };
}

export default function HobbyHubPage() {
  return <GroupsList />;
}
