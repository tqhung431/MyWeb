import type { Metadata } from "next";
import { GroupsList } from "@/features/hobby/GroupsList";

export const metadata: Metadata = { title: "Hobby Hub" };

export default function HobbyHubPage() {
  return <GroupsList />;
}
