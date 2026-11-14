// /messages: private chats (Stage 21 in Hobby Hub; Stage 28 its own app with its own badge).
// Desktop: your chats on the left, the open chat on the right. Phone: the list, or the open chat (with a back button).
import { AppHeader } from "@/components/shell/AppHeader";
import { MessagesShell } from "@/features/hobby/MessagesShell";

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader appId="messages" />
      <MessagesShell>{children}</MessagesShell>
    </>
  );
}
