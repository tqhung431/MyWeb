// Shown when the Companion can't answer yet: AI off, Ollama not running, or models still downloading.
// The rest of Nook works without it.

import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { CompanionStatus } from "@/lib/api/companion";

import { useT } from "@/lib/i18n/I18nProvider";
export function StatusCard({ status, onRetry }: { status: CompanionStatus | null; onRetry: () => void }) {
  const t = useT();
  let title = t("The Companion is resting");
  let text = t("Nook's API didn't answer. Check that it's running, then try again.");
  // Stage 27: no server commands here; the person who runs Nook finds them in the docs and in Admin → Health
  if (status && !status.enabled) {
    title = t("The Companion is turned off");
    text = t("It needs a small AI model on the Nook PC, and that's switched off here. Everything else in Nook works without it.");
  } else if (status && !status.reachable) {
    title = t("The Companion is resting");
    text = t("The AI on the Nook PC isn't answering right now. Try again in a little while, or tell the person who runs Nook.");
  } else if (status && !status.ready) {
    title = t("Downloading the AI models…");
    text = t("The first download is about 1.5 GB, then it's instant. Try again in a few minutes.");
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden="true" /> {title}
          </span>
        }
        action={
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t("Check again")}
          </Button>
        }
      />
      <p className="text-muted">{text}</p>

    </Card>
  );
}
