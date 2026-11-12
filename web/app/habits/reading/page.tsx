import type { Metadata } from "next";
import { Reading } from "@/features/habits/Reading";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Reading") };
}

export default function Page() {
  return <Reading />;
}
