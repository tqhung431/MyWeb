// Stage 23 · Ngõ Pháo: little sounds made with the Web Audio API (no sound files): a firecracker pop,
// crates cracking, a power-up chime, the lion dance drum. Muted with the same switch as Mini Arcade.

import { isMuted } from "@/features/arcade/sfx";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(a: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(a.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

export type AlleySound = "pop" | "tiny" | "crate" | "power" | "out" | "drop" | "lion" | "tick" | "go" | "win" | "lose";

export function play(name: AlleySound) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  if (name === "pop" || name === "tiny") {
    // a crackle of little pops and a low thump
    const n = noise(a, name === "tiny" ? 0.15 : 0.35);
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = name === "tiny" ? 3000 : 1400;
    const g = a.createGain();
    g.gain.value = name === "tiny" ? 0.25 : 0.6;
    n.connect(f).connect(g).connect(a.destination);
    n.start(t);
    if (name === "pop") {
      tone(a, 140, t, 0.25, "sine", 0.5, 50);
      for (let i = 1; i < 5; i++) {
        const c = noise(a, 0.04);
        const cg = a.createGain();
        cg.gain.value = 0.2;
        c.connect(cg).connect(a.destination);
        c.start(t + 0.05 * i + Math.random() * 0.03);
      }
    }
  } else if (name === "crate") {
    const n = noise(a, 0.12);
    const f = a.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 2000;
    n.connect(f).connect(a.destination);
    n.start(t);
  } else if (name === "power") {
    [660, 880, 1320].forEach((fr, i) => tone(a, fr, t + i * 0.06, 0.15, "triangle", 0.15));
  } else if (name === "out") {
    tone(a, 520, t, 0.4, "square", 0.08, 130);
  } else if (name === "drop") {
    tone(a, 300, t, 0.08, "triangle", 0.15, 200);
  } else if (name === "lion") {
    for (let i = 0; i < 8; i++) tone(a, i % 4 === 0 ? 90 : 120, t + i * 0.18, 0.15, "sine", i % 4 === 0 ? 0.5 : 0.3, 60);
    for (let i = 0; i < 4; i++) {
      const c = noise(a, 0.1);
      const cg = a.createGain();
      cg.gain.value = 0.15;
      c.connect(cg).connect(a.destination);
      c.start(t + 0.09 + i * 0.36); // the cymbal
    }
  } else if (name === "tick") {
    tone(a, 880, t, 0.08, "sine", 0.15);
  } else if (name === "go") {
    tone(a, 1320, t, 0.25, "sine", 0.2);
  } else if (name === "win") {
    [523, 659, 784, 1047].forEach((fr, i) => tone(a, fr, t + i * 0.12, 0.3, "triangle", 0.18));
  } else if (name === "lose") {
    [392, 330, 262].forEach((fr, i) => tone(a, fr, t + i * 0.15, 0.3, "triangle", 0.15));
  }
}
