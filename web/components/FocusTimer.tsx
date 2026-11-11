"use client"; // handles clicks → runs in the browser

import { MODES, useChill, type Mode } from "./ChillProvider";
import { PillButton } from "./PillButton";

export function FocusTimer() {
  const { mode, setMode, time, remaining, total, running, start, pause, reset, sessions, sessionsStatus } =
    useChill();

  let label = "Start";
  if (running) label = "Pause";
  else if (remaining === 0) label = "Again";
  else if (remaining < total) label = "Resume";

  function onMainClick() {
    if (running) pause();
    else if (remaining === 0) reset();
    else start();
  }

  return (
    <section className="card" aria-labelledby="timer-title">
      <h2 id="timer-title">Focus timer</h2>

      <div className="modes" role="group" aria-label="Timer mode">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <PillButton key={m} className="mode" pressed={mode === m} onClick={() => setMode(m)}>
            {MODES[m].label}
          </PillButton>
        ))}
      </div>

      <p className="time" role="timer" aria-live="off">
        {time}
      </p>

      <div className="controls">
        <button type="button" className="primary" onClick={onMainClick}>
          {label}
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>

      <p className="hint" id="sessions" aria-live="polite">
        {sessionsStatus === "loading" && "Loading your sessions…"}
        {sessionsStatus === "offline" && "Offline: start the API to save your sessions."}
        {sessionsStatus === "ready" &&
          sessions &&
          `Focus sessions today: ${sessions.today.sessions} · this week: ${sessions.total}`}
      </p>
    </section>
  );
}
