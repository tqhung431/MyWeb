"use client";

// Stage 27: "Report" on someone else's post, comment or message. Asks first, then tells the admin; a small notice
// says it's done. The admin sees only that one thing (never the rest of a private chat).

import { useConfirm } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { report, type Report } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { useT } from "@/lib/i18n/I18nProvider";

export function useReport() {
  const t = useT();
  const confirm = useConfirm();
  const toast = useToast();
  return async (kind: Report["kind"], id: number) => {
    const ok = await confirm({
      title: t("Report this to the admin?"),
      description: t("The admin will see this one message (or post) and who wrote it, and can delete it."),
      confirmLabel: t("Report"),
    });
    if (!ok) return;
    try {
      await report(kind, id);
      toast(t("Reported. Thank you."), { tone: "success" });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t("That didn't work"), { tone: "error" });
    }
  };
}
