// Stage 21: /hobby-hub/messages. Desktop: your chats on the left, the open chat on the right.
// Phone: the list, or the open chat (with a back button).
import { MessagesShell } from "@/features/hobby/MessagesShell";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <MessagesShell>{children}</MessagesShell>;
}
