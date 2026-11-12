// "/watchlist/t/12": one title on someone's list, with everyone's ratings and notes.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitlePage } from "@/features/watch/TitlePage";

import { getT } from "@/lib/i18n/server";
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("WatchList") };
}

export default async function WatchTitlePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <TitlePage id={id} />;
}
