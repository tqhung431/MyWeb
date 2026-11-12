// Tiny sound effects, made on the fly with the Web Audio API (no sound files to download).
// An oscillator makes a tone; we slide its pitch and fade its volume to get "boop", "bonk", "ta-da".

type Wave = OscillatorType;
type Note = {
  from: number;
  to?: number;
  ms: number;
  wave?: Wave;
  at?: number;
  gain?: number;
};

const SOUNDS = {
  eat: [{ from: 520, to: 880, ms: 90, wave: "square", gain: 0.08 }],
  spicy: [
    { from: 300, to: 1200, ms: 180, wave: "sawtooth", gain: 0.06 },
    { from: 1200, to: 600, ms: 120, wave: "sawtooth", at: 180, gain: 0.05 },
  ],
  flip: [{ from: 700, to: 500, ms: 60, wave: "triangle" }],
  match: [
    { from: 660, ms: 90, wave: "triangle" },
    { from: 990, ms: 140, wave: "triangle", at: 90 },
  ],
  miss: [{ from: 240, to: 160, ms: 160, wave: "sine" }],
  bonk: [{ from: 180, to: 60, ms: 140, wave: "square", gain: 0.12 }],
  star: [
    { from: 880, ms: 70, wave: "square", gain: 0.06 },
    { from: 1320, ms: 70, wave: "square", at: 70, gain: 0.06 },
    { from: 1760, ms: 120, wave: "square", at: 140, gain: 0.06 },
  ],
  meow: [
    { from: 600, to: 900, ms: 120, wave: "sawtooth", gain: 0.05 },
    { from: 900, to: 400, ms: 260, wave: "sawtooth", at: 120, gain: 0.05 },
  ],
  drop: [{ from: 300, to: 180, ms: 90, wave: "sine", gain: 0.2 }],
  perfect: [
    { from: 784, ms: 80, wave: "triangle" },
    { from: 1047, ms: 80, wave: "triangle", at: 80 },
    { from: 1568, ms: 160, wave: "triangle", at: 160 },
  ],
  go: [{ from: 1046, ms: 120, wave: "square", gain: 0.07 }],
  tick: [{ from: 660, ms: 70, wave: "square", gain: 0.05 }],
  cluck: [
    { from: 900, to: 500, ms: 70, wave: "square", gain: 0.06 },
    { from: 900, to: 500, ms: 70, wave: "square", at: 110, gain: 0.06 },
    { from: 1100, to: 400, ms: 160, wave: "square", at: 220, gain: 0.06 },
  ],
  win: [
    { from: 523, ms: 110, wave: "triangle" },
    { from: 659, ms: 110, wave: "triangle", at: 110 },
    { from: 784, ms: 110, wave: "triangle", at: 220 },
    { from: 1047, ms: 280, wave: "triangle", at: 330 },
  ],
  lose: [
    { from: 392, ms: 160, wave: "sawtooth", gain: 0.05 },
    { from: 330, ms: 160, wave: "sawtooth", at: 170, gain: 0.05 },
    { from: 262, to: 200, ms: 420, wave: "sawtooth", at: 340, gain: 0.05 },
  ],
} satisfies Record<string, Note[]>;

export type Sound = keyof typeof SOUNDS;

const MUTE_KEY = "nook.arcade.muted";
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // private mode
  }
}

export function sfx(name: Sound) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ctx ??= new AudioContext(); // browsers only allow this after a tap or key press: games call sfx from those
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const note of SOUNDS[name] as Note[]) {
      const start = now + (note.at ?? 0) / 1000;
      const end = start + note.ms / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = note.wave ?? "sine";
      osc.frequency.setValueAtTime(note.from, start);
      if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, end);
      gain.gain.setValueAtTime(note.gain ?? 0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, end); // fade out, so it doesn't click
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
  } catch {
    // no Web Audio: play silently
  }
}
