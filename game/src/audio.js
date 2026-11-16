// Emberwarden — all sound, synthesised live with WebAudio.
// One clear job: no audio files, no network — every effect and the ambient
// music loop are built from oscillators and filtered noise at run time.
// The context is created lazily on the first user gesture (browsers block
// audio before that) and stays muted until then.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  /** A-minor-ish pad chords the music loop walks through. */
  const CHORDS = [
    [110.0, 130.81, 164.81, 220.0],
    [87.31, 130.81, 164.81, 207.65],
    [98.0, 146.83, 196.0, 246.94],
    [82.41, 123.47, 164.81, 196.0],
  ];
  /** Sparse pluck melody notes (Hz) over the pads, -1 means rest. */
  const MELODY = [440, -1, 523.25, -1, 659.25, -1, 523.25, 392, -1, 440, -1, 329.63, -1, 392, -1, -1];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') void context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      startMusic();
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.15, vol = 0.3, when = 0, attack = 0.005 }) {
    if (!context || muted) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, vol = 0.3, when = 0, low = 400, high = 4000 }) {
    if (!context || muted) return;
    const t0 = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * dur));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (low + high) / 2;
    filter.Q.value = 0.8;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function startMusic() {
    if (musicTimer !== null) return;
    musicTimer = window.setInterval(() => {
      if (!context || muted) return;
      const chord = CHORDS[Math.floor(musicStep / 4) % CHORDS.length];
      const note = MELODY[musicStep % MELODY.length];
      if (musicStep % 4 === 0) {
        for (const freq of chord) {
          const osc = context.createOscillator();
          const gain = context.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const t0 = context.currentTime;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.5, t0 + 0.6);
          gain.gain.linearRampToValueAtTime(0, t0 + 2.4);
          osc.connect(gain);
          gain.connect(musicGain);
          osc.start(t0);
          osc.stop(t0 + 2.5);
        }
      }
      if (note > 0) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sine';
        osc.frequency.value = note;
        const t0 = context.currentTime;
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(t0);
        osc.stop(t0 + 1);
      }
      musicStep += 1;
    }, 500);
  }

  return {
    /** Call on any user gesture; safe to call often. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone({ type: 'square', freq: 720, freqEnd: 320, dur: 0.07, vol: 0.08 });
    },
    hit() {
      noise({ dur: 0.05, vol: 0.12, low: 800, high: 3000 });
    },
    enemyDie() {
      noise({ dur: 0.22, vol: 0.25, low: 200, high: 1800 });
      tone({ type: 'sawtooth', freq: 220, freqEnd: 55, dur: 0.22, vol: 0.14 });
    },
    pickup() {
      tone({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.09, vol: 0.12 });
    },
    hurt() {
      tone({ type: 'sawtooth', freq: 160, freqEnd: 60, dur: 0.25, vol: 0.3 });
      noise({ dur: 0.15, vol: 0.2, low: 100, high: 900 });
    },
    dash() {
      noise({ dur: 0.16, vol: 0.16, low: 1200, high: 5000 });
    },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.22, vol: 0.2, when: i * 0.09 }));
    },
    waveStart() {
      tone({ type: 'sawtooth', freq: 98, freqEnd: 196, dur: 0.5, vol: 0.18 });
      tone({ type: 'sawtooth', freq: 147, freqEnd: 294, dur: 0.5, vol: 0.1, when: 0.05 });
    },
    bossRoar() {
      tone({ type: 'sawtooth', freq: 70, freqEnd: 45, dur: 0.9, vol: 0.32 });
      noise({ dur: 0.8, vol: 0.22, low: 80, high: 500 });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.35, vol: 0.22, when: i * 0.12 }));
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.4, vol: 0.2, when: i * 0.16 }));
    },
    click() {
      tone({ type: 'sine', freq: 660, dur: 0.05, vol: 0.12 });
    },
  };
}
