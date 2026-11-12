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
  let command: string | null = null;

  if (status && !status.enabled) {
    title = t("The Companion is turned off");
    text = t("It runs a small AI model on this computer with Ollama. Everything else in Nook works without it. To turn it on:");
    command = "docker compose --profile app --profile ai up -d";
  } else if (status && !status.reachable) {
    title = t("Can't reach Ollama");
    text = t("The Companion is turned on, but Ollama isn't answering. Start it again:");
    command = "docker compose --profile app --profile ai up -d";
  } else if (status && !status.ready) {
    const missing = [!status.models.chat && status.chatModel, !status.models.embed && status.embedModel].filter(Boolean).join(` ${t("and")} `);
    title = t("Downloading the AI models…");
    text = t("Waiting for {models}. The first download is about 1.5 GB, then it's instant. To follow it:", { models: missing });
    command = "docker compose logs -f ollama-models";
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
      {command && <pre className="mt-3 overflow-x-auto rounded-2xl bg-surface-muted px-4 py-3 text-sm">{command}</pre>}
      <p className="mt-3 text-sm text-muted">{t("See docs/stage-9.md for details.")}</p>
    </Card>
  );
}
