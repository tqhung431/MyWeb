// /settings (Stage 21): language, light/dark and colour theme
import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Settings") };
}

export default function Settings() {
  return <SettingsPage />;
}
