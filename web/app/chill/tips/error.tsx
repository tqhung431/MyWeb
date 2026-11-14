"use client"; // error pages must be client components (they get a reset function)

// Shown instead of the Tips pages when loading throws (e.g. the API is down).
// The app header, sidebar and running timer stay on screen.

import { CloudOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

import { useT } from "@/lib/i18n/I18nProvider";
export default function TipsError({ reset }: { error: Error; reset: () => void }) {
  const t = useT();
  return (
    <Card className="flex max-w-xl flex-col items-start gap-3">
      <CloudOff className="h-8 w-8 text-primary" aria-hidden="true" />
      <h2 className="text-xl font-bold">{t("Tips are resting")}</h2>
      <p className="text-muted">{t("We couldn't reach Nook right now. Try again in a moment.")}</p>
      <Button variant="primary" onClick={reset} className="mt-2">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t("Try again")}
      </Button>
    </Card>
  );
}
