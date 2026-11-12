// "/hobby-hub/cooking": one group's posts and chat. Groups are made by people, so any slug may exist.
import type { Metadata } from "next";
import { GroupPage } from "@/features/hobby/GroupPage";

import { getT } from "@/lib/i18n/server";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Hobby Hub") };
}

export default async function HobbyGroupPage({ params }: Props) {
  return <GroupPage slug={(await params).slug} />;
}
