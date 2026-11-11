// Stage 15: a labelled text box for longer writing, the same style as <Input>.

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = ComponentProps<"textarea"> & { label: string; hint?: ReactNode; error?: string };

export function Textarea({ label, hint, error, className, id, rows = 4, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? noteId : undefined}
        className={cn(
          "w-full resize-y rounded-2xl border bg-surface-strong/70 px-4 py-3 text-text transition placeholder:text-muted/70",
          "focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none",
          error ? "border-rose-500/70" : "border-border",
        )}
        {...props}
      />
      {(error || hint) && (
        <p id={noteId} className={cn("text-xs", error ? "font-medium text-rose-600 dark:text-rose-400" : "text-muted")}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
