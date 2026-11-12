import type { Metadata } from "next";
import { DirectChat } from "@/features/hobby/DirectChat";

type Props = { params: Promise<{ userId: string }> };

export const metadata: Metadata = { title: "Messages · Hobby Hub" };

export default async function DirectChatPage({ params }: Props) {
  return <DirectChat userId={(await params).userId} />;
}
