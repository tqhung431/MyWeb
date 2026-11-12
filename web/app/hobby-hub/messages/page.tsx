import type { Metadata } from "next";

export const metadata: Metadata = { title: "Messages · Hobby Hub" };

// The list is in the layout (MessagesShell); on a big screen this fills the right side.
export default function MessagesPage() {
  return (
    <div className="hidden h-full items-center justify-center rounded-3xl border border-dashed border-border p-8 text-center lg:flex">
      <div>
        <p className="text-4xl" aria-hidden="true">
          💬
        </p>
        <p className="mt-2 font-semibold">Pick a chat, or start a new one</p>
        <p className="text-sm text-muted">Private chats are only for the two of you.</p>
      </div>
    </div>
  );
}
