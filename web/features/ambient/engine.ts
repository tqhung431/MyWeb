// The sound engine: every sound and every piece of music is generated live with the
// Web Audio API. There are no recordings, so there's nothing to license.
//
// Stage 5: several tracks can play at once (a mixer). Each track gets its own volume:
//
//   track generator ─► track volume ─┐
//   track generator ─► track volume ─┼─► master volume ─► speakers
//            └──► reverb (shared) ───┘
//
// This is a plain module, not React. It only runs in the browser, from click handlers
// (browsers need a click before they allow sound).

export type TrackName =
  | "lofi-beats"
  | "keys"
  | "night-piano"
  | "music-box"
  | "ambient-pad"
  | "rain"
  | "waves"
  | "fireplace"
  | "forest"
  | "stream"
  | "brown-noise";

type StopFn = () => void;
type Generator = (ac: AudioContext, out: AudioNode, fx: Fx) => StopFn;
type Fx = { reverb: AudioNode }; // send a signal here to add room echo

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let fx: Fx | null = null;
const playing = new Map<TrackName, { bus: GainNode; stop: StopFn }>();
let masterVolume = 0.7;

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = masterVolume;
    master.connect(ctx.destination);

    // A shared reverb: a convolver "plays" each sound through a fake room's echo.
    // The room is 3 s of noise that fades out, which sounds like a soft hall.
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverb.connect(wet).connect(master);
    fx = { reverb };
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const midi = (note: number) => 440 * 2 ** ((note - 69) / 12); // 69 = A4 = 440 Hz
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function impulse(ac: AudioContext, seconds: number): AudioBuffer {
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

function noise(ac: AudioContext, colour: "white" | "pink" | "brown"): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, colour);
  src.loop = true;
  return src;
}

function filter(ac: AudioContext, type: BiquadFilterType, frequency: number, Q = 0.7): BiquadFilterNode {
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = Q;
  return f;
}

function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

// A step sequencer: calls onStep(time, step) slightly AHEAD of time, so notes are perfectly
// in time even if the page is busy. (Background tabs check only once a second, hence 1.2 s ahead.)
function sequence(ac: AudioContext, stepSeconds: number | (() => number), onStep: (time: number, step: number) => void): StopFn {
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
function epiano(ac: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number) {
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
function piano(ac: AudioContext, out: AudioNode, freq: number, t: number, vol: number) {
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
function bell(ac: AudioContext, out: AudioNode, freq: number, t: number, vol: number) {
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
function kick(ac: AudioContext, out: AudioNode, t: number, vol = 0.9) {
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

function burst(ac: AudioContext, out: AudioNode, t: number, opts: { type: BiquadFilterType; freq: number; Q?: number; vol: number; decay: number }) {
  const src = noise(ac, "white");
  const env = ac.createGain();
  env.gain.setValueAtTime(opts.vol, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
  src.connect(filter(ac, opts.type, opts.freq, opts.Q)).connect(env).connect(out);
  const offset = Math.random() * 3; // start somewhere random in the noise, so hits don't sound identical
  src.start(t, offset);
  src.stop(t + opts.decay + 0.02);
}

const snare = (ac: AudioContext, out: AudioNode, t: number, vol = 0.35) =>
  burst(ac, out, t, { type: "highpass", freq: 1400, vol, decay: 0.16 });
const hat = (ac: AudioContext, out: AudioNode, t: number, vol = 0.08) =>
  burst(ac, out, t, { type: "highpass", freq: 7500, vol, decay: 0.045 });

// A chord progression shared by several tracks: C major 7 → A minor 9 → F major 7 → G 6
const PROGRESSION = [
  { root: 48, notes: [60, 64, 67, 71] },
  { root: 45, notes: [57, 60, 64, 67, 71] },
  { root: 41, notes: [57, 60, 64, 65] },
  { root: 43, notes: [55, 59, 62, 64] },
];

// ---------------------------------------------------------------------------
// The tracks
// ---------------------------------------------------------------------------

const generators: Record<TrackName, Generator> = {
  // --- Music ---

  "lofi-beats"(ac, out) {
    // 78 beats per minute, 16 steps per bar, a lazy "swing" on the off-beats.
    const step = 60 / 78 / 4;
    const tone = filter(ac, "lowpass", 3200); // dull the highs, like an old tape
    tone.connect(out);
    const drums = gain(ac, 0.22);
    drums.connect(tone);
    const keysBus = gain(ac, 1);
    keysBus.connect(tone);
    const chords = [
      { bass: 38, notes: [62, 65, 69, 72, 76] }, // Dm9
      { bass: 43, notes: [59, 62, 65, 69] }, // G9
      { bass: 36, notes: [60, 64, 67, 71, 74] }, // Cmaj9
      { bass: 45, notes: [60, 64, 67, 71] }, // Am9
    ];
    const crackle = noise(ac, "white");
    const crackleLevel = gain(ac, 0.012);
    crackle.connect(filter(ac, "bandpass", 3000, 0.5)).connect(crackleLevel).connect(out);
    crackle.start();

    const stopSeq = sequence(ac, step, (t, n) => {
      const s = n % 16;
      const bar = Math.floor(n / 16) % chords.length;
      const time = t + (s % 4 === 2 ? step * 0.18 : 0); // swing
      const chord = chords[bar];
      if (s === 0) chord.notes.forEach((m) => epiano(ac, keysBus, midi(m), time + rand(0, 0.03), step * 14, 0.045));
      if (s === 10) chord.notes.slice(1).forEach((m) => epiano(ac, keysBus, midi(m), time, step * 5, 0.025));
      if (s === 0 || s === 10) epiano(ac, keysBus, midi(chord.bass), time, step * 6, 0.09); // bass
      if (s === 0 || s === 7 || s === 10) kick(ac, drums, time, s === 0 ? 0.9 : 0.6);
      if (s === 4 || s === 12) snare(ac, drums, time);
      if (s % 2 === 0) hat(ac, drums, time, s % 4 === 0 ? 0.07 : 0.045);
    });
    return () => {
      stopSeq();
      crackle.stop();
    };
  },

  keys(ac, out) {
    // The original Stage 1 sound: soft strummed chords and tape hiss.
    const warm = filter(ac, "lowpass", 1100);
    warm.connect(out);
    const hiss = noise(ac, "brown");
    hiss.connect(gain(ac, 0.05)).connect(out);
    hiss.start();
    const stopSeq = sequence(ac, 4, (t, n) => {
      PROGRESSION[n % 4].notes.slice(0, 4).forEach((m, i) => {
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midi(m - 12);
        osc.detune.value = rand(-6, 6);
        const env = ac.createGain();
        const start = t + i * 0.06;
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(0.4, start + 0.4);
        env.gain.exponentialRampToValueAtTime(0.001, start + 4.5);
        osc.connect(env).connect(warm);
        osc.start(start);
        osc.stop(start + 4.6);
      });
    });
    return () => {
      stopSeq();
      hiss.stop();
    };
  },

  "night-piano"(ac, out, { reverb }) {
    // Slow chords low down, and a wandering melody on a pentatonic scale (no "wrong" notes).
    const dry = gain(ac, 1.3);
    dry.connect(out);
    const send = gain(ac, 0.8);
    send.connect(reverb);
    const scale = [72, 74, 76, 79, 81, 84, 86];
    let pos = 2;
    const stopSeq = sequence(ac, 0.45, (t, n) => {
      const chord = PROGRESSION[Math.floor(n / 8) % 4];
      const both = (node: (dest: AudioNode) => void) => {
        node(dry);
        node(send);
      };
      if (n % 8 === 0) {
        both((d) => piano(ac, d, midi(chord.root), t, 0.09));
        chord.notes.slice(0, 3).forEach((m, i) => both((d) => piano(ac, d, midi(m), t + 0.05 + i * 0.04, 0.045)));
      }
      if (Math.random() < 0.55) {
        pos = Math.max(0, Math.min(scale.length - 1, pos + pick([-2, -1, -1, 1, 1, 2])));
        both((d) => piano(ac, d, midi(scale[pos]), t + rand(0, 0.04), rand(0.035, 0.06)));
      }
    });
    return stopSeq;
  },

  "music-box"(ac, out, { reverb }) {
    // Chord tones, two octaves up, played up and down like a wind-up box.
    const send = gain(ac, 0.7);
    send.connect(reverb);
    const pattern = [0, 1, 2, 3, 2, 1, 0, 2];
    const stopSeq = sequence(ac, 0.3, (t, n) => {
      const chord = PROGRESSION[Math.floor(n / 16) % 4];
      const note = chord.notes[pattern[n % pattern.length] % chord.notes.length] + 12;
      const vol = n % 8 === 0 ? 0.07 : 0.05;
      bell(ac, out, midi(note), t + rand(0, 0.02), vol * 1.6);
      bell(ac, send, midi(note), t, vol * 0.6);
    });
    return stopSeq;
  },

  "ambient-pad"(ac, out, { reverb }) {
    // Long, soft chords that fade into each other every 10 s.
    const tone = filter(ac, "lowpass", 700, 0.5);
    const lfo = ac.createOscillator(); // slowly opens and closes the filter
    lfo.frequency.value = 0.05;
    const depth = gain(ac, 350);
    lfo.connect(depth).connect(tone.frequency);
    lfo.start();
    tone.connect(out);
    tone.connect(gain(ac, 0.5)).connect(reverb);

    let voices: { env: GainNode; oscs: OscillatorNode[] }[] = [];
    const stopSeq = sequence(ac, 10, (t, n) => {
      const chord = PROGRESSION[n % 4];
      voices.forEach((v) => {
        v.env.gain.setTargetAtTime(0, t, 1.2); // fade the old chord out
        v.oscs.forEach((o) => o.stop(t + 6));
      });
      voices = [chord.root, ...chord.notes.slice(0, 3)].map((m) => {
        const env = ac.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.05, t + 4);
        const oscs = [-8, 8].map((cents) => {
          const o = ac.createOscillator();
          o.type = "sawtooth";
          o.frequency.value = midi(m);
          o.detune.value = cents; // two slightly out-of-tune copies "shimmer"
          o.connect(env);
          o.start(t);
          return o;
        });
        env.connect(tone);
        return { env, oscs };
      });
    });
    return () => {
      stopSeq();
      lfo.stop();
      voices.forEach((v) => v.oscs.forEach((o) => o.stop()));
    };
  },

  // --- Nature & noise ---

  rain(ac, out) {
    const src = noise(ac, "white");
    src.connect(filter(ac, "highpass", 800)).connect(filter(ac, "lowpass", 5000)).connect(gain(ac, 0.22)).connect(out);
    src.start();
    // a few heavier drops
    const stopSeq = sequence(ac, () => rand(0.05, 0.3), (t) =>
      burst(ac, out, t, { type: "bandpass", freq: rand(2000, 6000), Q: 2, vol: rand(0.02, 0.08), decay: 0.02 }),
    );
    return () => {
      stopSeq();
      src.stop();
    };
  },

  waves(ac, out) {
    const src = noise(ac, "brown");
    const swell = gain(ac, 0.3);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.09; // one wave every ~11 s
    lfo.connect(gain(ac, 0.4)).connect(swell.gain);
    src.connect(filter(ac, "lowpass", 600)).connect(swell).connect(out);
    src.start();
    lfo.start();
    return () => {
      src.stop();
      lfo.stop();
    };
  },

  fireplace(ac, out) {
    // A low roar plus random crackles and the odd pop.
    const roar = noise(ac, "brown");
    roar.connect(filter(ac, "lowpass", 350)).connect(gain(ac, 0.45)).connect(out);
    roar.start();
    const stopSeq = sequence(ac, () => rand(0.03, 0.22), (t) => {
      const pop = Math.random() < 0.08;
      burst(ac, out, t, {
        type: "bandpass",
        freq: pop ? rand(600, 1200) : rand(1500, 5000),
        Q: 1,
        vol: pop ? rand(0.25, 0.45) : rand(0.03, 0.18),
        decay: pop ? 0.06 : rand(0.005, 0.03),
      });
    });
    return () => {
      stopSeq();
      roar.stop();
    };
  },

  forest(ac, out, { reverb }) {
    // Wind in the trees, and birds calling from left and right.
    const wind = noise(ac, "pink");
    const windLevel = gain(ac, 0.18);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    lfo.connect(gain(ac, 0.1)).connect(windLevel.gain);
    wind.connect(filter(ac, "bandpass", 500, 0.6)).connect(windLevel).connect(out);
    wind.start();
    lfo.start();

    const stopSeq = sequence(ac, () => rand(0.8, 3.5), (t) => {
      const pan = ac.createStereoPanner();
      pan.pan.value = rand(-0.85, 0.85);
      pan.connect(out);
      pan.connect(gain(ac, 0.3)).connect(reverb);
      const base = rand(2400, 4200);
      const chirps = Math.floor(rand(2, 6));
      for (let i = 0; i < chirps; i++) {
        const start = t + i * rand(0.09, 0.16);
        const osc = ac.createOscillator();
        osc.frequency.setValueAtTime(base, start);
        osc.frequency.exponentialRampToValueAtTime(base * rand(0.7, 1.35), start + 0.08);
        const env = ac.createGain();
        env.gain.setValueAtTime(0, start);
        env.gain.linearRampToValueAtTime(0.05, start + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
        osc.connect(env).connect(pan);
        osc.start(start);
        osc.stop(start + 0.12);
      }
    });
    return () => {
      stopSeq();
      wind.stop();
      lfo.stop();
    };
  },

  stream(ac, out) {
    // Two bands of noise whose loudness and pitch wobble randomly: "babbling" water.
    const layers = [
      { freq: 1100, Q: 0.9, level: 0.28 },
      { freq: 2800, Q: 1.4, level: 0.12 },
    ].map(({ freq, Q, level }) => {
      const src = noise(ac, "white");
      const band = filter(ac, "bandpass", freq, Q);
      const g = gain(ac, level);
      src.connect(band).connect(g).connect(out);
      src.start();
      return { src, band, g, freq, level };
    });
    const stopSeq = sequence(ac, 0.09, (t) => {
      for (const l of layers) {
        l.g.gain.setTargetAtTime(l.level * rand(0.5, 1.4), t, 0.04);
        l.band.frequency.setTargetAtTime(l.freq * rand(0.75, 1.3), t, 0.05);
      }
    });
    return () => {
      stopSeq();
      layers.forEach((l) => l.src.stop());
    };
  },

  "brown-noise"(ac, out) {
    // Steady and deep: covers background chatter well.
    const src = noise(ac, "brown");
    src.connect(filter(ac, "lowpass", 900)).connect(gain(ac, 0.55)).connect(out);
    src.start();
    return () => src.stop();
  },
};

export const TRACK_NAMES = Object.keys(generators) as TrackName[];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function start(name: TrackName, volume = 0.8): void {
  const ac = ensureContext();
  if (playing.has(name)) return;
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0, ac.currentTime);
  bus.gain.linearRampToValueAtTime(volume, ac.currentTime + 1.5); // fade in
  bus.connect(master!);
  playing.set(name, { bus, stop: generators[name](ac, bus, fx!) });
}

export function stop(name: TrackName): void {
  const track = playing.get(name);
  if (!track || !ctx) return;
  playing.delete(name);
  const now = ctx.currentTime;
  track.bus.gain.cancelScheduledValues(now);
  track.bus.gain.setValueAtTime(track.bus.gain.value, now);
  track.bus.gain.linearRampToValueAtTime(0, now + 0.6); // fade out
  setTimeout(() => {
    track.stop();
    track.bus.disconnect();
  }, 1500); // a little longer than the fade, so notes scheduled ahead die quietly
}

export function stopAll(): void {
  [...playing.keys()].forEach(stop);
}

export function setTrackVolume(name: TrackName, volume: number): void {
  const track = playing.get(name);
  if (track && ctx) track.bus.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

export function setVolume(volume: number): void {
  masterVolume = volume;
  if (ctx && master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

// A gentle two-note bell when the timer ends. Plays even with no sound on.
export function chime(): void {
  const ac = ensureContext();
  [659.25, 987.77].forEach((freq, n) => bell(ac, ac.destination, freq, ac.currentTime + n * 0.35, 0.25));
}
