// "/account" — You (Stage 11): your name, your data and how long it's kept, "Delete me".
// Without a name yet, it asks for one.

import type { Metadata } from "next";
import { YouPage } from "@/features/me/YouPage";

export const metadata: Metadata = { title: "You" };

export default function AccountPage() {
  return <YouPage />;
}
