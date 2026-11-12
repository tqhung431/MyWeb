import type { Metadata } from "next";
import { AddSongForm } from "@/features/music/AddSongForm";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Add songs") };
}

export default function AddSongPage() {
  return <AddSongForm />;
}
