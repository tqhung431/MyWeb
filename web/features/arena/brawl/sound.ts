// Stage 25 · Chợ Đêm Brawl: little sounds made with the Web Audio API (no sound files). Muted with the same switch
// as Mini Arcade.

import { isMuted } from "@/features/arcade/sfx";

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined" || isMuted()) return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null; // no sound on this browser: the game goes on
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
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
function noise(a: AudioContext, start: number, dur: number, freq: number, vol: number) {
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination);
  src.start(start);
}

export type BrawlSound = "swing" | "bonk" | "away" | "hurt" | "down" | "up" | "special" | "heal" | "dodge" | "pop" | "wave" | "boss" | "coin" | "win" | "lose";

let lastBonk = 0;
export function play(name: BrawlSound) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  switch (name) {
    case "swing":
      noise(a, t, 0.12, 2400, 0.12);
      break;
    case "bonk":
      if (t - lastBonk < 0.05) return; // many at once sound like one
      lastBonk = t;
      tone(a, 520 + Math.random() * 120, t, 0.1, "square", 0.08, 260);
      noise(a, t, 0.06, 900, 0.2);
      break;
    case "away":
      tone(a, 700, t, 0.25, "triangle", 0.08, 1400);
      break;
    case "hurt":
      tone(a, 220, t, 0.18, "sawtooth", 0.08, 120);
      break;
    case "down":
      tone(a, 440, t, 0.5, "triangle", 0.12, 110);
      break;
    case "up":
    case "heal":
      [523, 659, 784].forEach((f, i) => tone(a, f, t + i * 0.07, 0.18, "sine", 0.1));
      break;
    case "special":
      noise(a, t, 0.4, 600, 0.3);
      tone(a, 180, t, 0.4, "sawtooth", 0.1, 600);
      break;
    case "dodge":
      noise(a, t, 0.15, 4000, 0.1);
      break;
    case "pop":
      noise(a, t, 0.2, 1800, 0.3);
      break;
    case "coin":
      tone(a, 988, t, 0.08, "square", 0.05);
      tone(a, 1319, t + 0.07, 0.15, "square", 0.05);
      break;
    case "wave":
      [392, 523].forEach((f, i) => tone(a, f, t + i * 0.12, 0.2, "triangle", 0.12));
      break;
    case "boss":
      for (let i = 0; i < 3; i++) tone(a, 110, t + i * 0.25, 0.22, "sawtooth", 0.15, 90);
      break;
    case "win":
      [523, 659, 784, 1047].forEach((f, i) => tone(a, f, t + i * 0.12, 0.3, "triangle", 0.14));
      break;
    case "lose":
      [392, 330, 262].forEach((f, i) => tone(a, f, t + i * 0.18, 0.3, "triangle", 0.12));
      break;
  }
}
