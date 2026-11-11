// A labelled text field with an optional hint and error message.
// The label, hint and error are linked to the input, so screen readers read them together.

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = ComponentProps<"input"> & { label: string; hint?: ReactNode; error?: string; trailing?: ReactNode };

export function Input({ label, hint, error, trailing, className, id, ...props }: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-12 w-full rounded-2xl border bg-surface-strong/70 px-4 text-text transition placeholder:text-muted/70",
            "focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none",
            error ? "border-rose-500/70" : "border-border",
            trailing && "pr-12",
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
