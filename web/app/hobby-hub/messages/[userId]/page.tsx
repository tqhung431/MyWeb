import type { Metadata } from "next";
import { DirectChat } from "@/features/hobby/DirectChat";

import { getT } from "@/lib/i18n/server";
type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Messages · Hobby Hub") };
}

export default async function DirectChatPage({ params }: Props) {
  return <DirectChat userId={(await params).userId} />;
}
