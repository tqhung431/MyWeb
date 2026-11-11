"use client";

// Stage 17: Vân Lộ's music and sound effects, made live with the Web Audio API (no recordings, nothing to license).
//
//   Music: a plucked-string melody on a pentatonic scale (like a guzheng), wandering note by note,
//          over a soft drone. Calm at home, darker in a secret realm, with war drums in a tribulation.
//   Effects: sword strokes, hits, lightning, healing, picking things up, the furnace, a gong for breakthroughs.
//
// Browsers only let sound start after a tap or a key press, so the sound starts on your first one.

export type Mood = "home" | "realm" | "tribulation";
export type SfxName = "slash" | "hit" | "crit" | "hurt" | "bolt" | "heal" | "pickup" | "die" | "craft" | "fail" | "gong" | "summon" | "click";
type Settings = { music: boolean; sfx: boolean; volume: number };

const KEY = "nook.vanlo.sound";
let settings: Settings = { music: true, sfx: true, volume: 0.6 };
try {
  if (typeof localStorage !== "undefined") settings = { ...settings, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
} catch {
  // keep the defaults
}

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
const listeners = new Set<() => void>();

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = settings.volume;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = settings.music ? 0.55 : 0;
    musicBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = settings.sfx ? 0.9 : 0;
    sfxBus.connect(master);
    // Start (or resume) on the first tap or key press
    const wake = () => void ctx?.resume();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
  }
  return ctx;
}

export const getSound = () => settings;
export function setSound(change: Partial<Settings>) {
  settings = { ...settings, ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // storage blocked: the change lasts for this visit
  }
  const ac = audio();
  if (ac) {
    master.gain.setTargetAtTime(settings.volume, ac.currentTime, 0.05);
    musicBus.gain.setTargetAtTime(settings.music ? 0.55 : 0, ac.currentTime, 0.1);
    sfxBus.gain.setTargetAtTime(settings.sfx ? 0.9 : 0, ac.currentTime, 0.05);
  }
  listeners.forEach((l) => l());
}
export function subscribeSound(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---- Instruments ----
const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// A plucked string: a quick bend up into the note, a bright attack, a long soft fade
function pluck(ac: AudioContext, out: AudioNode, freq: number, at: number, loud = 0.25, length = 1.6) {
  const o = ac.createOscillator();
  const o2 = ac.createOscillator();
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  o.type = "triangle";
  o2.type = "sine";
  o.frequency.setValueAtTime(freq * 0.985, at);
  o.frequency.exponentialRampToValueAtTime(freq, at + 0.05);
  o2.frequency.setValueAtTime(freq * 2, at);
  f.type = "lowpass";
  f.frequency.setValueAtTime(3200, at);
  f.frequency.exponentialRampToValueAtTime(700, at + length * 0.6);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(loud, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const g2 = ac.createGain();
  g2.gain.value = 0.25;
  o.connect(f);
  o2.connect(g2).connect(f);
  f.connect(g).connect(out);
  o.start(at);
  o2.start(at);
  o.stop(at + length + 0.05);
  o2.stop(at + length + 0.05);
}

function noiseBurst(ac: AudioContext, out: AudioNode, at: number, length: number, loud: number, filter: BiquadFilterType, from: number, to: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * length), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const f = ac.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + length);
  const g = ac.createGain();
  g.gain.setValueAtTime(loud, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  src.connect(f).connect(g).connect(out);
  src.start(at);
}

function thump(ac: AudioContext, out: AudioNode, at: number, from = 150, to = 50, loud = 0.5, length = 0.25) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + length);
  g.gain.setValueAtTime(loud, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + length);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + length + 0.02);
}

// A temple gong: a few out-of-tune sine partials that ring for a long time
function gong(ac: AudioContext, out: AudioNode, at: number) {
  for (const [ratio, loud] of [
    [1, 0.35],
    [1.48, 0.2],
    [2.12, 0.12],
    [2.9, 0.08],
  ]) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.value = 98 * ratio;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(loud, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 4);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + 4.1);
  }
}

// ---- Effects ----
export function sfx(name: SfxName) {
  const ac = audio();
  if (!ac || !settings.sfx || ac.state !== "running") return;
  const t = ac.currentTime + 0.005;
  const out = sfxBus;
  switch (name) {
    case "slash":
      noiseBurst(ac, out, t, 0.14, 0.35, "bandpass", 4000, 700);
      break;
    case "hit":
      thump(ac, out, t, 160, 60, 0.45, 0.12);
      noiseBurst(ac, out, t, 0.04, 0.2, "highpass", 2000, 1500);
      break;
    case "crit":
      thump(ac, out, t, 200, 55, 0.55, 0.16);
      pluck(ac, out, midi(88), t + 0.02, 0.12, 0.5);
      break;
    case "hurt":
      thump(ac, out, t, 110, 45, 0.5, 0.18);
      noiseBurst(ac, out, t, 0.08, 0.25, "lowpass", 900, 300);
      break;
    case "bolt":
      noiseBurst(ac, out, t, 0.45, 0.5, "lowpass", 5000, 200);
      thump(ac, out, t + 0.02, 70, 30, 0.6, 0.6);
      break;
    case "heal":
      pluck(ac, out, midi(76), t, 0.18, 1);
      pluck(ac, out, midi(81), t + 0.09, 0.15, 1.2);
      break;
    case "pickup":
      pluck(ac, out, midi(79), t, 0.16, 0.6);
      pluck(ac, out, midi(84), t + 0.07, 0.14, 0.8);
      break;
    case "die":
      noiseBurst(ac, out, t, 0.3, 0.25, "lowpass", 1200, 150);
      pluck(ac, out, midi(57), t, 0.12, 0.9);
      break;
    case "craft":
      [72, 76, 79, 84].forEach((n, i) => pluck(ac, out, midi(n), t + i * 0.08, 0.15, 1));
      break;
    case "fail":
      noiseBurst(ac, out, t, 0.5, 0.3, "lowpass", 600, 100);
      break;
    case "gong":
      gong(ac, out, t);
      break;
    case "summon":
      thump(ac, out, t, 120, 50, 0.45, 0.2);
      thump(ac, out, t + 0.16, 120, 50, 0.45, 0.2);
      break;
    case "click":
      pluck(ac, out, midi(79), t, 0.08, 0.3);
      break;
  }
}

// ---- Music ----
// Gong mode (C D E G A) at home; yu mode (A C D E G, darker) in realms; shang mode with drums in a tribulation
const SCALES: Record<Mood, { notes: number[]; beat: number; rest: number; drone: number[]; drums: boolean }> = {
  home: { notes: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81], beat: 0.62, rest: 0.45, drone: [36, 43], drums: false },
  realm: { notes: [57, 60, 62, 64, 67, 69, 72, 74, 76, 79], beat: 0.5, rest: 0.4, drone: [33, 40], drums: false },
  tribulation: { notes: [62, 64, 67, 69, 72, 74, 76, 79], beat: 0.3, rest: 0.55, drone: [38, 45], drums: true },
};

let mood: Mood | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let next = 0;
let step = 0;
let note = 4;
let drone: OscillatorNode[] = [];
let droneGain: GainNode | null = null;

export function setMusic(m: Mood | null) {
  const ac = audio();
  if (!ac || m === mood) return;
  mood = m;
  if (timer) clearInterval(timer);
  timer = null;
  if (droneGain) {
    droneGain.gain.setTargetAtTime(0, ac.currentTime, 0.4);
    const old = drone;
    setTimeout(() => old.forEach((o) => o.stop()), 2000);
    drone = [];
    droneGain = null;
  }
  if (!m) return;
  const scale = SCALES[m];
  droneGain = ac.createGain();
  droneGain.gain.value = 0;
  droneGain.gain.setTargetAtTime(0.06, ac.currentTime, 1.5);
  droneGain.connect(musicBus);
  drone = scale.drone.map((n) => {
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = midi(n);
    o.connect(droneGain!);
    o.start();
    return o;
  });
  next = ac.currentTime + 0.3;
  // Look ahead: every 200 ms, schedule the notes for the next half second
  timer = setInterval(() => {
    if (ac.state !== "running") return;
    while (next < ac.currentTime + 0.5) {
      step++;
      if (scale.drums && step % 2 === 0) thump(ac, musicBus, next, 90, 40, step % 8 === 0 ? 0.5 : 0.28, 0.3);
      if (Math.random() > scale.rest) {
        // wander up or down the scale, mostly by small steps
        note = Math.max(0, Math.min(scale.notes.length - 1, note + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        pluck(ac, musicBus, midi(scale.notes[note]), next, 0.16 + Math.random() * 0.08, 2.2);
        if (step % 8 === 0) pluck(ac, musicBus, midi(scale.notes[note] - 12), next, 0.1, 2.6); // a low note now and then
      }
      next += scale.beat * (step % 4 === 3 ? 1.5 : 1); // a little lilt
    }
  }, 200);
}
