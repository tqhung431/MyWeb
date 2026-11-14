// Stage 26 · Mầm Thú: soft little sounds from the Web Audio API (no sound files). Muted with the Mini Arcade switch.
import { isMuted } from "@/features/arcade/sfx";

let ctx: AudioContext | null = null;
function ac() {
  if (typeof window === "undefined" || typeof AudioContext === "undefined" || isMuted()) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(a: AudioContext, f: number, at: number, dur: number, type: OscillatorType, vol: number, to?: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g).connect(a.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export type SproutSound = "step" | "grass" | "talk" | "hit" | "big" | "weak" | "heal" | "faint" | "win" | "lose" | "friend" | "shy" | "level" | "grow" | "ripple" | "good" | "meh" | "pot" | "bell" | "encounter";

export function play(name: SproutSound) {
  let a: AudioContext | null = null;
  try {
    a = ac();
  } catch {
    return; // no sound on this browser: the game goes on
  }
  if (!a) return;
  const t = a.currentTime;
  const notes = (fs: number[], gap: number, dur: number, type: OscillatorType = "triangle", vol = 0.1) => fs.forEach((f, i) => tone(a, f, t + i * gap, dur, type, vol));
  switch (name) {
    case "step":
      tone(a, 180, t, 0.04, "sine", 0.03);
      break;
    case "grass":
      tone(a, 900, t, 0.05, "triangle", 0.02, 500);
      break;
    case "talk":
      notes([660, 880], 0.05, 0.06, "square", 0.03);
      break;
    case "hit":
      tone(a, 300, t, 0.12, "square", 0.07, 120);
      break;
    case "big":
      tone(a, 420, t, 0.2, "sawtooth", 0.08, 140);
      notes([880], 0, 0.12, "square", 0.05);
      break;
    case "weak":
      tone(a, 220, t, 0.1, "sine", 0.06, 160);
      break;
    case "heal":
    case "level":
      notes([523, 659, 784, 1047], 0.07, 0.14, "triangle", 0.08);
      break;
    case "faint":
      tone(a, 520, t, 0.5, "triangle", 0.1, 120);
      break;
    case "win":
    case "friend":
      notes([523, 659, 784, 1047, 1319], 0.1, 0.25, "triangle", 0.1);
      break;
    case "lose":
    case "shy":
      notes([440, 370, 294], 0.15, 0.25, "triangle", 0.08);
      break;
    case "grow":
      tone(a, 200, t, 0.8, "sine", 0.1, 900);
      notes([784, 988, 1175, 1568], 0.12, 0.3, "triangle", 0.08);
      break;
    case "ripple":
      tone(a, 700, t, 0.2, "sine", 0.08, 1100);
      break;
    case "good":
      notes([784, 1047], 0.06, 0.12);
      break;
    case "meh":
      tone(a, 330, t, 0.12, "triangle", 0.06);
      break;
    case "pot":
      tone(a, 200, t, 0.1, "sine", 0.12, 140);
      break;
    case "bell":
      tone(a, 1318, t, 0.6, "sine", 0.1);
      tone(a, 2637, t, 0.4, "sine", 0.03);
      break;
    case "encounter":
      notes([392, 523, 659, 523, 784], 0.07, 0.1, "square", 0.05);
      break;
  }
}
