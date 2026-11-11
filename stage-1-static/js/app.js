// Connects the page (DOM) to Ambient (audio.js) and createTimer (timer.js).
// This file is the only one that touches HTML elements.

// ---- Sounds ---------------------------------------------------------------

const trackButtons = document.querySelectorAll(".track");
const volumeInput = document.querySelector("#volume");
const nowPlaying = document.querySelector("#now-playing");

trackButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const name = button.dataset.track;
    if (Ambient.playing() === name) {
      Ambient.stop(); // clicking the playing sound turns it off
    } else {
      Ambient.play(name);
    }
    updateTrackButtons();
  });
});

function updateTrackButtons() {
  const playing = Ambient.playing();
  trackButtons.forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.track === playing));
  });
  const active = document.querySelector('.track[aria-pressed="true"]');
  nowPlaying.textContent = active ? `Now playing: ${active.textContent.trim()}` : "Nothing playing";
}

volumeInput.addEventListener("input", () => {
  Ambient.setVolume(volumeInput.value / 100);
});

// ---- Timer ----------------------------------------------------------------

const MODES = { focus: 25, short: 5, long: 15 };
let mode = "focus";

const timeEl = document.querySelector("#time");
const startBtn = document.querySelector("#start");
const resetBtn = document.querySelector("#reset");
const modeButtons = document.querySelectorAll(".mode");
const sessionsEl = document.querySelector("#sessions");

function format(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const timer = createTimer({
  onTick(ms) {
    timeEl.textContent = format(ms);
    document.title = timer.isRunning() ? `${format(ms)} · Chill Corner` : "Chill Corner · Nook";
  },
  onDone() {
    Ambient.chime();
    if (mode === "focus") addSession();
    startBtn.textContent = "Start";
    document.title = "Time's up! · Chill Corner";
  },
});

startBtn.addEventListener("click", () => {
  if (timer.isRunning()) {
    timer.pause();
    startBtn.textContent = "Resume";
  } else {
    timer.start();
    startBtn.textContent = "Pause";
  }
});

resetBtn.addEventListener("click", () => {
  timer.reset();
  startBtn.textContent = "Start";
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    modeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    timer.set(MODES[mode]);
    startBtn.textContent = "Start";
  });
});

// ---- Focus sessions saved in the browser (localStorage) -------------------

const today = new Date().toISOString().slice(0, 10); // e.g. "2026-11-11"

function readSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem("sessions") || "{}");
    return saved.date === today ? saved.count : 0;
  } catch {
    return 0; // storage blocked or broken: just start from zero
  }
}

function addSession() {
  const count = readSessions() + 1;
  try {
    localStorage.setItem("sessions", JSON.stringify({ date: today, count }));
  } catch {
    // ignore: the count still shows for this visit
  }
  sessionsEl.textContent = `Focus sessions today: ${count}`;
}

sessionsEl.textContent = `Focus sessions today: ${readSessions()}`;
timer.set(MODES[mode]);
