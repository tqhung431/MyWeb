// Ambient sounds made live with the Web Audio API — the Stage 1 audio.js, now in TypeScript.
//
// This is a plain module, not a React component. It runs only in the browser,
// and only from click handlers, because browsers need a user gesture before sound.

export type TrackName = "rain" | "waves" | "keys";

type StopFn = () => void;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let current: { name: TrackName; bus: GainNode; stopSources: StopFn } | null = null;
let volume = 0.6;

function ensureContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

// Two seconds of random noise, looped. "white" = hiss, "brown" = deep rumble.
function makeNoise(ac: AudioContext, type: "white" | "brown"): AudioBufferSourceNode {
  const length = ac.sampleRate * 2;
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (type === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function makeFilter(ac: AudioContext, type: BiquadFilterType, frequency: number): BiquadFilterNode {
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  return filter;
}

function gain(ac: AudioContext, value: number): GainNode {
  const g = ac.createGain();
  g.gain.value = value;
  return g;
}

// --- The three sounds: each one plays into `bus` and returns a stop function ---

const sounds: Record<TrackName, (ac: AudioContext, bus: GainNode) => StopFn> = {
  rain(ac, bus) {
    const noise = makeNoise(ac, "white");
    noise
      .connect(makeFilter(ac, "highpass", 800))
      .connect(makeFilter(ac, "lowpass", 5000))
      .connect(gain(ac, 0.25))
      .connect(bus);
    noise.start();
    return () => noise.stop();
  },

  waves(ac, bus) {
    const noise = makeNoise(ac, "brown");
    const swell = gain(ac, 0.5);
    const lfo = ac.createOscillator(); // slow wobble = waves
    lfo.frequency.value = 0.09;
    lfo.connect(gain(ac, 0.4)).connect(swell.gain);
    noise.connect(makeFilter(ac, "lowpass", 600)).connect(swell).connect(bus);
    noise.start();
    lfo.start();
    return () => {
      noise.stop();
      lfo.stop();
    };
  },

  keys(ac, bus) {
    // Fmaj7, Em7, Dm7, Cmaj7
    const chords = [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63],
      [130.81, 164.81, 196.0, 246.94],
    ];
    const chordSeconds = 4;
    const warm = makeFilter(ac, "lowpass", 1100);
    warm.connect(bus);

    const hiss = makeNoise(ac, "brown");
    hiss.connect(gain(ac, 0.05)).connect(bus);
    hiss.start();

    let index = 0;
    const playChord = () => {
      const start = ac.currentTime + 0.05;
      chords[index % chords.length].forEach((freq, n) => {
        const osc = ac.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 12;
        const env = ac.createGain();
        const t = start + n * 0.06;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.08, t + 0.4);
        env.gain.exponentialRampToValueAtTime(0.001, t + chordSeconds + 0.5);
        osc.connect(env).connect(warm);
        osc.start(t);
        osc.stop(t + chordSeconds + 0.6);
      });
      index++;
    };

    playChord();
    const timer = setInterval(playChord, chordSeconds * 1000);
    return () => {
      clearInterval(timer);
      hiss.stop();
    };
  },
};

// --- Public API ---

export function stop(): void {
  if (!current || !ctx) return;
  const { bus, stopSources } = current;
  bus.gain.cancelScheduledValues(ctx.currentTime);
  bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
  bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => {
    stopSources();
    bus.disconnect();
  }, 700);
  current = null;
}

export function play(name: TrackName): void {
  const ac = ensureContext();
  stop();
  const bus = ac.createGain();
  bus.gain.setValueAtTime(0, ac.currentTime);
  bus.gain.linearRampToValueAtTime(1, ac.currentTime + 1.5);
  bus.connect(master!);
  current = { name, bus, stopSources: sounds[name](ac, bus) };
}

export function setVolume(value: number): void {
  volume = value;
  if (ctx && master) master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
}

export function chime(): void {
  const ac = ensureContext();
  [659.25, 987.77].forEach((freq, n) => {
    const osc = ac.createOscillator();
    osc.frequency.value = freq;
    const env = ac.createGain();
    const t = ac.currentTime + n * 0.35;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    osc.connect(env).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 2);
  });
}
