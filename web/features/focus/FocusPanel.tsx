"use client";

import { Pause, Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useFocus } from "./FocusProvider";
import { MODE_OPTIONS, MODES } from "./logic";
import { TimerRing } from "./TimerRing";
import { TimerSettings } from "./TimerSettings";
import { LivePill } from "@/features/realtime/LiveNow";

import { useT } from "@/lib/i18n/I18nProvider";
export function FocusPanel() {
  const t = useT();
  const focus = useFocus();
  const { mode, running, remaining, total, finished } = focus;
  const [showSettings, setShowSettings] = useState(false);

  let label = t("Start");
  if (running) label = t("Pause");
  else if (remaining === 0) label = t("Again");
  else if (remaining < total) label = t("Resume");

  const state = finished ? t("Time's up") : running ? t("In progress") : remaining < total ? t("Paused") : t("Ready");

  function onMainClick() {
    if (running) focus.pause();
    else if (remaining === 0) focus.reset();
    else focus.start();
  }

  return (
    <Card aria-labelledby="timer-title" className="flex flex-col">
      <CardHeader
        id="timer-title"
        title={t("Focus timer")}
        subtitle={t("One task. One session.")}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={running ? "primary" : finished ? "success" : "neutral"}>{state}</Badge>
            <Button
              variant={showSettings ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowSettings((v) => !v)}
              aria-expanded={showSettings}
              aria-controls="timer-settings"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {t("Times")}
            </Button>
          </div>
        }
      />

      {showSettings && (
        <div id="timer-settings" className="mb-4">
          <TimerSettings />
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <SegmentedControl label={t("Timer mode")} options={MODE_OPTIONS} value={mode} onChange={focus.setMode} />
        <LivePill />
      </div>

      <div className="my-6 flex flex-1 items-center sm:my-8">
        <TimerRing value={1 - focus.progress}>
          <p role="timer" aria-live="off" className="text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
            {focus.time}
          </p>
          <p className="mt-1 text-sm font-medium text-muted">
            {t(MODES[mode].label)} · {t("{n} min", { n: Math.round(total / 60000) })}
          </p>
        </TimerRing>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Button variant="secondary" size="icon" onClick={focus.reset} aria-label={t("Reset timer")}>
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </Button>
        <Button variant="primary" size="lg" onClick={onMainClick} className="min-w-40">
          {running ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
          {label}
        </Button>
      </div>
    </Card>
  );
}
