// Building blocks for generated music: notes, noise, filters, a step sequencer and instruments.
// Used by engine.ts (the original tracks) and drill.ts (the Vietnamese drill instrumentals).

export type StopFn = () => void;

export const midi = (note: number) => 440 * 2 ** ((note - 69) / 12); // 69 = A4 = 440 Hz
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export function impulse(ac: AudioContext, seconds: number): AudioBuffer {
  const length = ac.sampleRate * seconds;
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

// Noise, made once per colour and reused. Two channels of different noise sound wide (stereo).
const noiseCache = new Map<string, AudioBuffer>();
function noiseBuffer(ac: AudioContext, colour: "white" | "pink" | "brown"): AudioBuffer {
  const cached = noiseCache.get(colour);
  if (cached) return cached;
  const length = ac.sampleRate * 4;
  const buffer = ac.createBuffer(2, length, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === "white") d[i] = w;
      else if (colour === "brown") d[i] = (last = (last + 0.02 * w) / 1.02) * 3.5; // deep rumble
      else {
        // pink: softer than white, like wind or a waterfall
        b0 = 0.997 * b0 + 0.029591 * w;
        b1 = 0.985 * b1 + 0.032534 * w;
        b2 = 0.95 * b2 + 0.048056 * w;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 1.6;
      }
    }
  }
  noiseCache.set(colour, buffer);
  return buffer;
}

export function noise(ac: AudioContext, colour: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, colour);
  src.loop = true;
  return src;
}

export function filter(ac: AudioContext, type: BiquadFilterType, frequency: number, Q = 0.7): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

export function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

// A step sequencer: calls onStep(time, step) slightly AHEAD of time, so notes are perfectly
// in time even if the page is busy. (Background tabs check only once a second, hence 1.2 s ahead.)
export function sequence(ac: AudioContext, stepSeconds: number | (() => number), onStep: (time: number, step: number) => void): StopFn {
  let next = ac.currentTime + 0.1;
  let step = 0;
  const tick = () => {
    while (next < ac.currentTime + 1.2) {
      onStep(next, step++);
      next += typeof stepSeconds === "number" ? stepSeconds : stepSeconds();
    }
  };
  tick();
  const id = setInterval(tick, 100);
  return () => clearInterval(id);
}

// --- Instruments ---------------------------------------------------------------

// Electric piano: a sine plus a quieter octave, fading out.
export function epiano(ac: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number) {
  for (const [mult, level, type] of [
    [1, 1, "sine"],
    [2, 0.25, "triangle"],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * mult;
    osc.detune.value = rand(-6, 6);
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol * level, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

// Piano-ish: a few harmonics; higher ones fade faster, like a real string.
export function piano(ac: AudioContext, out: AudioNode, freq: number, t: number, vol: number) {
  [1, 2, 3, 4].forEach((n) => {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * n;
    const env = ac.createGain();
    const decay = 3.2 / n;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol / n ** 1.4, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  });
}

// Bell / music box: "inharmonic" overtones (2.76×, 5.4×) give the metallic ring.
export function bell(ac: AudioContext, out: AudioNode, freq: number, t: number, vol: number) {
  for (const [mult, level, decay] of [
    [1, 1, 1.8],
    [2.76, 0.35, 0.9],
    [5.4, 0.12, 0.4],
  ]) {
    const osc = ac.createOscillator();
    osc.frequency.value = freq * mult;
    const env = ac.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol * level, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }
}

// Drums, all synthesised: a falling sine (kick), a noise burst (snare), a short hiss (hi-hat).
export function kick(ac: AudioContext, out: AudioNode, t: number, vol = 0.9) {
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const env = ac.createGain();
  env.gain.setValueAtTime(vol, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + 0.5);
}

export function burst(ac: AudioContext, out: AudioNode, t: number, opts: { type: BiquadFilterType; freq: number; Q?: number; vol: number; decay: number }) {
  const src = noise(ac, "white");
  const env = ac.createGain();
  env.gain.setValueAtTime(opts.vol, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  src.connect(filter(ac, opts.type, opts.freq, opts.Q)).connect(env).connect(out);
  const offset = Math.random() * 3; // start somewhere random in the noise, so hits don't sound identical
  src.start(t, offset);
  src.stop(t + opts.decay + 0.02);
}

export const snare = (ac: AudioContext, out: AudioNode, t: number, vol = 0.35) =>
  burst(ac, out, t, { type: "highpass", freq: 1400, vol, decay: 0.16 });
export const hat = (ac: AudioContext, out: AudioNode, t: number, vol = 0.08) =>
  burst(ac, out, t, { type: "highpass", freq: 7500, vol, decay: 0.045 });

// A chord progression shared by several tracks: C major 7 → A minor 9 → F major 7 → G 6
