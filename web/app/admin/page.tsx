// "/admin": the Admin page (Stage 27). Only for the admin; others are told how to become admin in Settings.
import type { Metadata } from "next";
import { AdminPage } from "@/features/admin/AdminPage";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function Admin() {
  return <AdminPage />;
}
