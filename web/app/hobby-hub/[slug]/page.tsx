// "/hobby-hub/cooking": one group's posts and chat. Groups are made by people, so any slug may exist.
import type { Metadata } from "next";
import { GroupPage } from "@/features/hobby/GroupPage";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Hobby Hub" };

export default async function HobbyGroupPage({ params }: Props) {
  return <GroupPage slug={(await params).slug} />;
}
