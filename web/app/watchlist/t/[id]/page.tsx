// "/watchlist/t/12": one title on someone's list, with everyone's ratings and notes.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TitlePage } from "@/features/watch/TitlePage";

type Props = { params: Promise<{ id: string }> };
export const metadata: Metadata = { title: "WatchList" };

export default async function WatchTitlePage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <TitlePage id={id} />;
}
