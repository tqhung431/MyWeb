"use client";

// Small pieces shared by WatchList's pages: poster, stars, the status menu.

import { Clapperboard, Star, Trash2, Tv } from "lucide-react";
import { useState } from "react";
import { Select, type SelectOption } from "@/components/ui/Select";
import { STATUS_LABEL, type Source, type Status } from "@/lib/api/watch";
import { cn } from "@/lib/cn";

export function Poster({ src, title, source, className }: { src: string | null; title: string; source?: Source; className?: string }) {
  const [broken, setBroken] = useState(false);
  const Icon = source === "anime" ? Clapperboard : Tv;
  return (
    <span className={cn("relative block aspect-[2/3] overflow-hidden rounded-2xl bg-linear-to-br from-sky-400 to-indigo-500 shadow-md", className)}>
      {src && !broken ? (
        // Posters come straight from TVmaze / MyAnimeList's image servers
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-2 text-center text-white">
          <Icon className="h-8 w-8" aria-hidden="true" />
          <span className="line-clamp-3 text-xs font-semibold">{title}</span>
        </span>
      )}
    </span>
  );
}

export function Stars({ value, onChange, size = "md" }: { value: number | null; onChange?: (v: number | null) => void; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  if (!onChange) {
    return (
      <span className="inline-flex text-amber-500" aria-label={value ? `${value} of 5 stars` : "No rating"}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} className={cn(cls, n <= (value ?? 0) ? "fill-current" : "opacity-30")} aria-hidden="true" />
        ))}
      </span>
    );
  }
  return (
    <span className="inline-flex" role="group" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value === n}
          className="cursor-pointer rounded p-0.5 text-amber-500 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Star className={cn(cls, n <= (value ?? 0) ? "fill-current" : "opacity-30")} aria-hidden="true" />
        </button>
      ))}
    </span>
  );
}

export const STATUS_TONE: Record<Status, string> = {
  want: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  watching: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  dropped: "bg-surface-muted text-muted",
};

const STATUS_ICON: Record<Status, string> = { want: "🔖", watching: "▶️", done: "✅", dropped: "💤" };

// The status menu (Stage 15: Nook's own dropdown instead of the browser's <select>).
export function StatusSelect({
  value,
  onChange,
  allowRemove,
  placeholder,
  className,
}: {
  value: Status | null;
  onChange: (s: Status | "remove") => void;
  allowRemove?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const options: SelectOption<Status | "remove">[] = (Object.keys(STATUS_LABEL) as Status[]).map((s) => ({
    value: s,
    label: STATUS_LABEL[s],
    icon: <span className="text-base leading-none">{STATUS_ICON[s]}</span>,
  }));
  if (allowRemove) options.push({ value: "remove", label: "Remove from my list", icon: <Trash2 className="h-4 w-4" />, danger: true });
  return (
    <Select<Status | "remove">
      label="Status"
      variant="pill"
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder ?? "+ Add to my list"}
      className={className}
      buttonClassName={value ? STATUS_TONE[value] : "bg-linear-to-r from-primary to-primary-2 text-on-primary"}
    />
  );
}
