// Every sound in the game, made from scratch with the Web Audio API: no audio
// files, no network. Short synth blips for shots, hits and pickups, a noise
// burst for explosions, and a quiet two-bar bass-and-arp loop for music.
// Nothing is created until the first user gesture (browsers block audio before
// that), and M mutes everything.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuffer = null;
  let muted = false;
  let musicTimer = null;
  let nextNoteTime = 0;
  let step = 0;

  /** Bass line (Hz) and arp notes for the two-bar loop, 132 BPM, 8th notes. */
  const BASS = [55, 0, 55, 0, 65.41, 0, 55, 0, 49, 0, 49, 0, 58.27, 0, 73.42, 0];
  const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 277.18, 246.94, 293.66, 369.99, 440, 369.99, 293.66, 246.94, 220];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      const len = ctx.sampleRate * 0.5;
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  function blip(freqA, freqB, seconds, type, volume) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  function noise(seconds, volume, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + seconds + 0.02);
  }

  function scheduleMusic() {
    if (!ctx || muted) return;
    const spb = 60 / 132 / 2; // 8th notes at 132 BPM
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const i = step % 16;
      const bass = BASS[i];
      if (bass > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = bass;
        gain.gain.setValueAtTime(0.5, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + spb * 0.9);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + spb);
      }
      if (step % 2 === 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = ARP[i] * 2;
        gain.gain.setValueAtTime(0.12, nextNoteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, nextNoteTime + spb * 0.8);
        osc.connect(gain);
        gain.connect(musicGain);
        osc.start(nextNoteTime);
        osc.stop(nextNoteTime + spb);
      }
      nextNoteTime += spb;
      step += 1;
    }
  }

  return {
    /** Call from any user gesture; starts audio and the music loop. */
    unlock() {
      if (!ensure()) return;
      if (musicTimer === null) {
        nextNoteTime = ctx.currentTime + 0.05;
        musicTimer = window.setInterval(scheduleMusic, 100);
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() { blip(920, 320, 0.09, 'square', 0.1); },
    enemyShoot() { blip(300, 140, 0.14, 'sawtooth', 0.07); },
    explosion(big) {
      noise(big ? 0.5 : 0.28, big ? 0.5 : 0.28, big ? 900 : 1400);
      blip(big ? 160 : 220, 40, big ? 0.5 : 0.3, 'sine', 0.4);
    },
    hit() { blip(180, 60, 0.18, 'sawtooth', 0.25); noise(0.12, 0.2, 900); },
    pickup() { blip(660, 990, 0.08, 'sine', 0.16); },
    heal() { blip(520, 780, 0.16, 'sine', 0.2); blip(780, 1040, 0.16, 'sine', 0.14); },
    dash() { noise(0.16, 0.16, 2400); },
    nova() {
      noise(0.8, 0.5, 600);
      blip(120, 1200, 0.7, 'sawtooth', 0.22);
      blip(1200, 180, 0.7, 'sine', 0.2);
    },
    waveClear() {
      blip(523, 523, 0.12, 'triangle', 0.18);
      window.setTimeout(() => blip(659, 659, 0.12, 'triangle', 0.18), 110);
      window.setTimeout(() => blip(784, 784, 0.22, 'triangle', 0.2), 220);
    },
    bossAlarm() { blip(110, 110, 0.3, 'sawtooth', 0.25); window.setTimeout(() => blip(110, 110, 0.3, 'sawtooth', 0.25), 350); },
    upgrade() { blip(440, 880, 0.14, 'triangle', 0.2); },
    gameOver() {
      blip(392, 392, 0.2, 'triangle', 0.2);
      window.setTimeout(() => blip(311, 311, 0.2, 'triangle', 0.2), 200);
      window.setTimeout(() => blip(233, 180, 0.5, 'triangle', 0.22), 400);
    },
    victory() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((n, i) => window.setTimeout(() => blip(n, n, 0.3, 'triangle', 0.22), i * 140));
    },
  };
}
