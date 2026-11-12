"use client";

// Add or change a habit: name, emoji, colour, how many days a week, an optional reminder.

import { Select } from "@/components/ui/Select";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api/client";
import type { Habit, HabitInput } from "@/lib/api/habits";
import { cn } from "@/lib/cn";
import { COLOR, COLORS } from "./colors";

const EMOJIS = ["📚", "🏃", "💧", "🧘", "🎸", "✍️", "🥗", "😴", "🇬🇧", "🧹", "💊", "🌱"];

export function HabitForm({ initial, onSave, onCancel }: { initial?: Habit; onSave: (h: HabitInput) => Promise<unknown>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);
  const [color, setColor] = useState(initial?.color ?? "violet");
  const [perWeek, setPerWeek] = useState(initial?.perWeek ?? 7);
  const [reminder, setReminder] = useState(initial?.reminderTime ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await onSave({ name, emoji, color, perWeek, reminderTime: reminder || null });
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Not saved: can't reach Nook.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5 shadow-card backdrop-blur-xl">
      <Input label="Habit" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Read 20 minutes" autoFocus error={error} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Emoji</legend>
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              aria-label={`Emoji ${e}`}
              className={cn(
                "h-10 w-10 cursor-pointer rounded-xl border text-xl",
                emoji === e ? "border-primary bg-primary/12" : "border-border hover:bg-surface-muted",
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Colour</legend>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-pressed={color === c}
              aria-label={c}
              className={cn("h-8 w-8 cursor-pointer rounded-full", COLOR[c].solid, color === c && "ring-2 ring-text ring-offset-2 ring-offset-background")}
            />
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select<number>
          label="How often"
          showLabel
          value={perWeek}
          onChange={setPerWeek}
          options={[7, 6, 5, 4, 3, 2, 1].map((n) => ({ value: n, label: n === 7 ? "Every day" : `${n} ${n === 1 ? "day" : "days"} a week` }))}
        />
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Reminder (optional)
          <input
            type="time"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className="h-12 rounded-2xl border border-border bg-surface-strong/70 px-3 font-normal focus:border-primary focus:outline-none"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!name.trim() || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {initial ? "Save" : "Add habit"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
