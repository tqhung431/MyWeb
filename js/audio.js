// Ambient sounds, generated live with the Web Audio API (no audio files).
//
// The idea: build a small graph of audio "nodes" and connect them:
//   source (noise or oscillator) -> filter -> gain (volume) -> master -> speakers
//
// Exposes one global object: Ambient

const Ambient = (() => {
  let ctx = null;      // the AudioContext, created on the first click (browsers require a user gesture)
  let master = null;   // master volume
  let current = null;  // { name, stop() } for the sound now playing
  let volume = 0.6;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  // Two seconds of random noise that we loop forever.
  // "white" = all frequencies equal (hiss), "brown" = deeper rumble.
  function makeNoise(type) {
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
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
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  function makeFilter(type, frequency) {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    return filter;
  }

  // Every sound plays into its own "bus" so we can fade it in and out.
  function makeBus() {
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5); // fade in
    bus.connect(master);
    return bus;
  }

  // --- The three sounds ---------------------------------------------------

  function rain(bus) {
    const noise = makeNoise("white");
    const level = ctx.createGain();
    level.gain.value = 0.25;
    noise
      .connect(makeFilter("highpass", 800))
      .connect(makeFilter("lowpass", 5000))
      .connect(level)
      .connect(bus);
    noise.start();
    return () => noise.stop();
  }

  function waves(bus) {
    const noise = makeNoise("brown");
    const swell = ctx.createGain();
    swell.gain.value = 0.5;

    // A very slow oscillator (LFO) moves the volume up and down like waves.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09; // one wave every ~11 seconds
    const depth = ctx.createGain();
    depth.gain.value = 0.4;
    lfo.connect(depth).connect(swell.gain);

    noise.connect(makeFilter("lowpass", 600)).connect(swell).connect(bus);
    noise.start();
    lfo.start();
    return () => {
      noise.stop();
      lfo.stop();
    };
  }

  function keys(bus) {
    // Four soft chords: Fmaj7, Em7, Dm7, Cmaj7 (frequencies in Hz).
    const chords = [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63],
      [130.81, 164.81, 196.0, 246.94],
    ];
    const chordSeconds = 4;
    const warm = makeFilter("lowpass", 1100);
    warm.connect(bus);

    // A little tape hiss for the lo-fi feel.
    const hiss = makeNoise("brown");
    const hissLevel = ctx.createGain();
    hissLevel.gain.value = 0.05;
    hiss.connect(hissLevel).connect(bus);
    hiss.start();

    let index = 0;
    function playChord() {
      const start = ctx.currentTime + 0.05;
      chords[index % chords.length].forEach((freq, n) => {
        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.detune.value = (Math.random() - 0.5) * 12; // slightly out of tune = warmer
        const env = ctx.createGain();
        const t = start + n * 0.06; // strum the notes
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.08, t + 0.4);
        env.gain.exponentialRampToValueAtTime(0.001, t + chordSeconds + 0.5);
        osc.connect(env).connect(warm);
        osc.start(t);
        osc.stop(t + chordSeconds + 0.6);
      });
      index++;
    }

    playChord();
    const timer = setInterval(playChord, chordSeconds * 1000);
    return () => {
      clearInterval(timer);
      hiss.stop();
    };
  }

  const sounds = { rain, waves, keys };

  // --- Public API ---------------------------------------------------------

  function stop() {
    if (!current) return;
    const { bus, stopSources } = current;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setValueAtTime(bus.gain.value, ctx.currentTime);
    bus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6); // fade out
    setTimeout(() => {
      stopSources();
      bus.disconnect();
    }, 700);
    current = null;
  }

  function play(name) {
    ensureContext();
    stop();
    const bus = makeBus();
    current = { name, bus, stopSources: sounds[name](bus) };
  }

  function setVolume(value) {
    volume = value;
    if (master) master.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
  }

  // A gentle two-note bell when the timer ends. Plays even with no sound on.
  function chime() {
    ensureContext();
    [659.25, 987.77].forEach((freq, n) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const env = ctx.createGain();
      const t = ctx.currentTime + n * 0.35;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(env).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 2);
    });
  }

  return {
    play,
    stop,
    setVolume,
    chime,
    playing: () => (current ? current.name : null),
  };
})();
