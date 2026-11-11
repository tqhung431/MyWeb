// A countdown timer that knows nothing about the page.
// It stores the moment it should end (endAt) instead of counting ticks,
// so it stays accurate even if the browser slows down a background tab.
//
// Exposes one global function: createTimer

function createTimer({ onTick, onDone }) {
  let total = 0;       // length of the current session, in ms
  let remaining = 0;   // ms left when paused
  let endAt = null;    // timestamp when running, null when paused
  let interval = null;

  function timeLeft() {
    return endAt ? Math.max(0, endAt - Date.now()) : remaining;
  }

  function tick() {
    const left = timeLeft();
    onTick(left);
    if (left === 0) {
      pause();
      onDone();
    }
  }

  function start() {
    if (endAt || remaining === 0) return;
    endAt = Date.now() + remaining;
    interval = setInterval(tick, 250);
    tick();
  }

  function pause() {
    if (!endAt) return;
    remaining = timeLeft();
    endAt = null;
    clearInterval(interval);
  }

  function set(minutes) {
    pause();
    total = minutes * 60 * 1000;
    remaining = total;
    onTick(remaining);
  }

  function reset() {
    set(total / 60000);
  }

  return {
    start,
    pause,
    set,
    reset,
    isRunning: () => endAt !== null,
  };
}
