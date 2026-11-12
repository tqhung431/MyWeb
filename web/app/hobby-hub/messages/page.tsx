import type { Metadata } from "next";

import { getT } from "@/lib/i18n/server";
export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("Messages · Hobby Hub") };
}

// The list is in the layout (MessagesShell); on a big screen this fills the right side.
export default async function MessagesPage() {
  const t = await getT();
  return (
    <div className="hidden h-full items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center lg:flex">
      <div>
        <p className="text-4xl" aria-hidden="true">
          💬
        </p>
        <p className="mt-2 font-semibold">{t("Pick a chat, or start a new one")}</p>
        <p className="text-sm text-muted">{t("Private chats are only for the two of you.")}</p>
      </div>
    </div>
  );
}
