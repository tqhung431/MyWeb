// "/account" — You (Stage 11): your name, your data and how long it's kept, "Delete me".
// Without a name yet, it asks for one.

import type { Metadata } from "next";
import { YouPage } from "@/features/me/YouPage";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("You") };
}

export default function AccountPage() {
  return <YouPage />;
}
