// Vietnamese drill: 10 ORIGINAL instrumentals, composed by this code. There are no vocals and no samples,
// and no existing songs are copied. Only the style is borrowed:
//
//   Drill:       ~140–146 BPM, a sliding 808 bass, snare on the 3rd beat, skipping triplet hi-hats,
//                dark minor chords
//   Vietnamese:  pentatonic "điệu" (modes), and three traditional instruments imitated by synthesis:
//                đàn bầu (one-string zither: long notes that bend and wobble), đàn tranh (plucked
//                16-string zither, with fast repeated "vê" plucks), sáo trúc (bamboo flute, breathy)
//
// Each song has a fixed seed, so its melody is the same every time you play it: a song, not noise.

import { bell, burst, filter, gain, hat, kick, midi, noise, piano, sequence, type StopFn } from "./synth";

type Instrument = "bau" | "tranh" | "sao" | "piano" | "bell";

// Vietnamese pentatonic modes, as semitones above the key note
const SCALES = {
  oan: [0, 3, 5, 7, 10], // điệu Oán (southern, mournful)
  bac: [0, 2, 5, 7, 9], // điệu Bắc (northern, brighter)
  ai: [0, 2, 3, 7, 8], // hơi Ai (sad)
} as const;

export type DrillSong = {
  id: string;
  title: string;
  meaning: string; // the title in English
  bpm: number;
  key: number; // midi note of the key, octave 3 (48–59)
  scale: keyof typeof SCALES;
  lead: Instrument;
  second: Instrument;
  chords: number[]; // chord roots per bar, semitones from the key (0 = i, -4 = VI, -2 = VII, -5 = v)
  seed: number;
};

export const DRILL_SONGS = [
  { id: "drill-hem-2am", title: "Hẻm 2AM", meaning: "The alley at 2 AM", bpm: 142, key: 54, scale: "oan", lead: "bau", second: "piano", chords: [0, -4, -2, -5], seed: 11 },
  { id: "drill-mai-ton", title: "Mưa Trên Mái Tôn", meaning: "Rain on a tin roof", bpm: 140, key: 50, scale: "bac", lead: "tranh", second: "bell", chords: [0, -2, -4, -2], seed: 23 },
  { id: "drill-sao-nua-dem", title: "Sáo Nửa Đêm", meaning: "Midnight flute", bpm: 144, key: 55, scale: "ai", lead: "sao", second: "tranh", chords: [0, -4, -5, -4], seed: 37 },
  { id: "drill-ben-cang", title: "Bến Cảng Khuya", meaning: "The harbour, late", bpm: 146, key: 52, scale: "oan", lead: "bau", second: "bell", chords: [0, 0, -4, -2], seed: 41 },
  { id: "drill-xe-om", title: "Xe Ôm Cuối Ngày", meaning: "Last motorbike ride of the day", bpm: 143, key: 57, scale: "bac", lead: "tranh", second: "piano", chords: [0, -4, 5, -2], seed: 58 },
  { id: "drill-da-lat", title: "Đà Lạt Sương Dày", meaning: "Thick fog in Đà Lạt", bpm: 140, key: 48, scale: "bac", lead: "sao", second: "bau", chords: [0, -4, -2, 0], seed: 64 },
  { id: "drill-cho-dem", title: "Chợ Đêm Ánh Neon", meaning: "Neon night market", bpm: 145, key: 59, scale: "oan", lead: "tranh", second: "bell", chords: [0, -2, -4, -5], seed: 79 },
  { id: "drill-song-han", title: "Sông Hàn 140", meaning: "The Hàn River at 140 BPM", bpm: 140, key: 49, scale: "oan", lead: "bell", second: "bau", chords: [0, -4, -2, -2], seed: 83 },
  { id: "drill-gio-bac", title: "Gió Bấc Hà Nội", meaning: "Hà Nội's north wind", bpm: 142, key: 56, scale: "ai", lead: "sao", second: "bau", chords: [0, -5, -4, -2], seed: 97 },
  { id: "drill-den-do", title: "Ngã Tư Đèn Đỏ", meaning: "The red-light crossroads", bpm: 144, key: 53, scale: "oan", lead: "piano", second: "tranh", chords: [0, -4, -2, -5], seed: 105 },
] as const satisfies readonly DrillSong[];

export type DrillId = (typeof DRILL_SONGS)[number]["id"];

// ---------------------------------------------------------------------------
// A tiny seeded random generator (mulberry32): same seed → same "random" choices → same song.
function seeded(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
  };
}

const softClip = (() => {
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 2.5);
  return curve;
})();

// ---------------------------------------------------------------------------
// Vietnamese-style instruments

// Đàn bầu: one string, pitch bent with a flexible rod. The note slides in from below,
// then a vibrato grows. A pure, flute-like tone (it's played with harmonics).
function bau(ac: AudioContext, out: AudioNode, note: number, t: number, dur: number, vol: number, from?: number) {
  const target = midi(note);
  const start = midi(from ?? note - 2);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.04);
  env.gain.setTargetAtTime(vol * 0.7, t + 0.2, 0.4);
  env.gain.setTargetAtTime(0, t + dur, 0.12);
  const vib = ac.createOscillator();
  vib.frequency.value = 5.5;
  const vibDepth = ac.createGain();
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(target * 0.012, t + Math.min(dur, 0.6)); // vibrato grows
  vib.connect(vibDepth);
  for (const [mult, level] of [
    [1, 1],
    [2, 0.18],
  ]) {
    const osc = ac.createOscillator();
    osc.frequency.setValueAtTime(start * mult, t);
    osc.frequency.exponentialRampToValueAtTime(target * mult, t + 0.14); // the bend
    vibDepth.connect(osc.frequency);
    const g = gain(ac, level);
    osc.connect(g).connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.6);
  }
  env.connect(out);
  vib.start(t);
  vib.stop(t + dur + 0.6);
}

// Đàn tranh: a bright pluck whose brightness fades fast, like a steel string.
function tranhPluck(ac: AudioContext, out: AudioNode, note: number, t: number, vol: number) {
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.setValueAtTime(5000, t);
  tone.frequency.exponentialRampToValueAtTime(900, t + 0.35);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  for (const [type, mult, level] of [
    ["triangle", 1, 1],
    ["sawtooth", 2, 0.12],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = midi(note) * mult;
    const g = gain(ac, level);
    osc.connect(g).connect(tone);
    osc.start(t);
    osc.stop(t + 1.4);
  }
  tone.connect(env).connect(out);
}

// Long tranh notes use "vê": the same note plucked again and again, quickly and softly.
function tranh(ac: AudioContext, out: AudioNode, note: number, t: number, dur: number, vol: number, step: number) {
  tranhPluck(ac, out, note, t, vol);
  if (dur > step * 3) {
    for (let x = t + step / 2; x < t + dur - step / 2; x += step / 2) tranhPluck(ac, out, note, x, vol * 0.45);
  }
}

// Sáo trúc: a breathy flute. A soft sine with a puff of noise, rising slightly into pitch.
function sao(ac: AudioContext, out: AudioNode, note: number, t: number, dur: number, vol: number) {
  const f = midi(note);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.07);
  env.gain.setTargetAtTime(0, t + dur, 0.08);
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(f * 0.985, t);
  osc.frequency.linearRampToValueAtTime(f, t + 0.08);
  const vib = ac.createOscillator();
  vib.frequency.value = 5;
  const depth = gain(ac, f * 0.006);
  vib.connect(depth).connect(osc.frequency);
  osc.connect(env);
  const breath = noise(ac, "white");
  const breathEnv = ac.createGain();
  breathEnv.gain.setValueAtTime(0, t);
  breathEnv.gain.linearRampToValueAtTime(vol * 0.25, t + 0.03);
  breathEnv.gain.setTargetAtTime(vol * 0.06, t + 0.08, 0.1);
  breathEnv.gain.setTargetAtTime(0, t + dur, 0.05);
  breath.connect(filter(ac, "bandpass", f * 2, 4)).connect(breathEnv).connect(out);
  env.connect(out);
  for (const node of [osc, vib]) {
    node.start(t);
    node.stop(t + dur + 0.5);
  }
  breath.start(t, Math.random() * 3);
  breath.stop(t + dur + 0.4);
}

function play(ac: AudioContext, out: AudioNode, inst: Instrument, note: number, t: number, dur: number, vol: number, step: number, from?: number) {
  if (inst === "bau") bau(ac, out, note, t, dur, vol, from);
  else if (inst === "tranh") tranh(ac, out, note, t, dur, vol * 0.8, step);
  else if (inst === "sao") sao(ac, out, note, t, dur, vol * 0.9);
  else if (inst === "piano") piano(ac, out, midi(note), t, vol * 0.9);
  else bell(ac, out, midi(note), t, vol * 0.6);
}

// ---------------------------------------------------------------------------
// One song = one generator

const BARS = { intro: 4, drop: 16, breakdown: 4 }; // then a second drop; then it loops
const SONG_BARS = BARS.intro + BARS.drop + BARS.breakdown + BARS.drop; // 40 bars ≈ 67 s

function section(bar: number): "intro" | "drop" | "breakdown" | "drop2" {
  const b = bar % SONG_BARS;
  if (b < BARS.intro) return "intro";
  if (b < BARS.intro + BARS.drop) return "drop";
  if (b < BARS.intro + BARS.drop + BARS.breakdown) return "breakdown";
  return "drop2";
}

export function drillGenerator(song: DrillSong) {
  return (ac: AudioContext, out: AudioNode, fx: { reverb: AudioNode }): StopFn => {
    const rng = seeded(song.seed);
    const step = 60 / song.bpm / 4; // one 16th note
    const scale = SCALES[song.scale];

    // --- Compose once, from the seed ---
    // A 2-bar melody: which 16th steps have a note, and which scale notes they are.
    const rhythm = rng.pick([
      [0, 3, 6, 10, 12, 16, 19, 22, 26],
      [0, 4, 7, 10, 14, 16, 20, 23, 28],
      [0, 2, 6, 8, 11, 16, 18, 22, 27],
    ]);
    let degree = rng.int(3) + 4; // index into an extended scale (several octaves)
    const motif = rhythm.map(() => (degree = Math.max(2, Math.min(11, degree + rng.pick([-2, -1, -1, 1, 1, 2, 0])))));
    const bassHits = rng.pick([
      [0, 6, 10],
      [0, 3, 10, 13],
      [0, 7, 11, 14],
    ]);
    const slides = new Set(bassHits.filter(() => rng.next() < 0.45)); // which 808 hits slide
    const ghostSnare = rng.pick([11, 14, 15]);
    const rolls = rng.pick([
      [6, 14],
      [2, 10],
      [6, 12],
    ]); // where hi-hat triplet rolls go

    const noteOf = (i: number) => song.key + 12 + 12 * Math.floor(i / 5) + scale[i % 5];
    const chordRoot = (bar: number) => song.key + song.chords[bar % song.chords.length];

    // --- Mixer for the song ---
    const master = gain(ac, 0.6); // drops are punchy; this keeps them as loud as the other tracks
    master.connect(out);
    const drums = gain(ac, 0.35);
    drums.connect(master);
    const shaper = ac.createWaveShaper(); // a little distortion makes the 808 growl
    shaper.curve = softClip;
    const bass = gain(ac, 0.2);
    shaper.connect(filter(ac, "lowpass", 900)).connect(bass).connect(master);
    const leadBus = gain(ac, 0.9);
    leadBus.connect(master);
    const send = gain(ac, 0.45);
    send.connect(fx.reverb);
    leadBus.connect(send);
    const padBus = filter(ac, "lowpass", 650, 0.4);
    const padLevel = gain(ac, 0.6);
    padBus.connect(padLevel).connect(master);
    padLevel.connect(send);

    let last808: GainNode | null = null;
    let lastBassNote = chordRoot(0) - 24;
    let lastLead = noteOf(motif[0]);

    const stopSeq = sequence(ac, step, (t, n) => {
      const s = n % 16; // step in the bar
      const bar = Math.floor(n / 16);
      const part = section(bar);
      const drop = part === "drop" || part === "drop2";
      const root = chordRoot(bar);

      // Dark pad: a minor or major chord, held for the whole bar
      if (s === 0 && part !== "breakdown") {
        const minor = [0, -5, -7, 5].includes(song.chords[bar % song.chords.length]);
        for (const interval of [0, minor ? 3 : 4, 7, 12]) {
          const env = ac.createGain();
          env.gain.setValueAtTime(0, t);
          env.gain.linearRampToValueAtTime(0.022, t + 0.3);
          env.gain.setTargetAtTime(0, t + step * 15, 0.15);
          for (const cents of [-7, 7]) {
            const o = ac.createOscillator();
            o.type = "sawtooth";
            o.frequency.value = midi(root - 12 + interval);
            o.detune.value = cents;
            o.connect(env);
            o.start(t);
            o.stop(t + step * 16 + 0.8);
          }
          env.connect(padBus);
        }
      }

      // Melody: the 2-bar motif, varied every 4th time (last notes move up a step)
      const pos = (bar % 2) * 16 + s;
      const idx = rhythm.indexOf(pos);
      if (idx >= 0 && part !== "breakdown") {
        const variation = Math.floor(bar / 2) % 4 === 3 && idx >= rhythm.length - 3 ? 1 : 0;
        const note = noteOf(motif[idx] + variation);
        const nextPos = rhythm[idx + 1] ?? 32;
        const dur = (nextPos - pos) * step;
        const vol = part === "intro" ? 0.07 : 0.1;
        play(ac, leadBus, song.lead, note, t, dur, vol, step, song.lead === "bau" ? lastLead : undefined);
        lastLead = note;
      }
      // Second instrument: answers on the chord in the drops, carries the breakdown alone
      if ((drop && s === 8 && bar % 2 === 1) || (part === "breakdown" && s % 4 === 0)) {
        const note = root + 12 + (part === "breakdown" ? scale[(s / 4 + bar) % 5] + 12 : 7);
        play(ac, leadBus, song.second, note, t, step * 6, 0.06, step);
      }

      if (part === "intro") return;

      // 808: long sliding bass on the chord root; a click (kick) on the first hit
      if (bassHits.includes(s) && (drop || s === 0)) {
        const note = root - 24 + (s === bassHits[bassHits.length - 1] && bar % 4 === 3 ? 12 : 0);
        last808?.gain.cancelScheduledValues(t);
        last808?.gain.setTargetAtTime(0, t, 0.01); // one 808 at a time
        const osc = ac.createOscillator();
        const env = ac.createGain();
        const from = slides.has(s) ? lastBassNote : note;
        osc.frequency.setValueAtTime(midi(from), t);
        osc.frequency.exponentialRampToValueAtTime(midi(note), t + (slides.has(s) ? 0.12 : 0.01));
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(1, t + 0.005);
        env.gain.setTargetAtTime(0, t + 0.2, 0.45);
        osc.connect(env).connect(shaper);
        osc.start(t);
        osc.stop(t + 2.5);
        last808 = env;
        lastBassNote = note;
        if (s === 0) kick(ac, drums, t, 0.7);
      }

      if (!drop) {
        if (s % 2 === 0) hat(ac, drums, t, 0.05); // breakdown: just soft hats
        return;
      }

      // Snare (clap-like) on beat 3, plus a ghost snare every other bar: the drill bounce
      if (s === 8) {
        burst(ac, drums, t, { type: "bandpass", freq: 1800, Q: 0.8, vol: 0.55, decay: 0.18 });
        burst(ac, drums, t + 0.012, { type: "highpass", freq: 3000, vol: 0.25, decay: 0.08 });
      }
      if (s === ghostSnare && bar % 2 === 1) burst(ac, drums, t, { type: "bandpass", freq: 1800, Q: 0.8, vol: 0.25, decay: 0.1 });

      // Hi-hats: 8th notes, with triplet rolls (3 hits in the space of 2) that make drill "skip"
      const rollHere = rolls.includes(s) && (part === "drop2" || bar % 2 === 1);
      if (rollHere) {
        for (let k = 0; k < 3; k++) hat(ac, drums, t + (k * step * 2) / 3, 0.06 - k * 0.008);
      } else if (s % 2 === 0) {
        hat(ac, drums, t, s % 4 === 0 ? 0.07 : 0.045);
      }
    });

    return () => {
      stopSeq();
      last808?.gain.cancelScheduledValues(ac.currentTime);
    };
  };
}
