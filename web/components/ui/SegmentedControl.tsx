// Pick one option from a few, like iOS segmented buttons.
// Generic: <SegmentedControl<Mode> ...> keeps `value` typed as your own union type.

import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string; // read by screen readers
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({ label, options, value, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-border bg-surface-muted p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition sm:px-4",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active ? "bg-surface-strong text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
