import type { Metadata } from "next";
import { AddSongForm } from "@/features/music/AddSongForm";

export const metadata: Metadata = { title: "Add a song" };

export default function AddSongPage() {
  return <AddSongForm />;
}
