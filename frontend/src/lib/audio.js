/**
 * Ambient sound engine — uses Web Audio API to synthesize CC0 / royalty-free
 * loops procedurally. Each "track" is a self-contained AudioBufferSourceNode +
 * filter graph wired to its own gain node, then summed into a master gain.
 *
 * Tracks: rain, ocean, forest, cafe, lofi, white
 * No copyrighted audio is loaded over the network.
 */

const TRACK_KEYS = ["rain", "ocean", "forest", "white"];

const TRACK_META = {
  rain: { label: "rain", emoji: "🌧" },
  ocean: { label: "ocean", emoji: "🌊" },
  forest: { label: "forest", emoji: "🌲" },
  white: { label: "white noise", emoji: "✦" },
};

class AmbientEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null; // ambient bus (already scaled by mute via muteGate)
    this.alertGain = null; // alert bus (also affected by mute)
    this.muteGate = null; // 0 if muted else 1
    this.tracks = {}; // key -> { gain, nodes: [], started: bool }
    this.master = 0.7; // user-set ambient master
    this.muted = false;
    this.noiseBuffer = null;
    this.pinkBuffer = null;
    this.brownBuffer = null;
    this.meowBuffers = []; // decoded AudioBuffers for cat meow chain
    this.meowLoaded = false;
    this.duckRestoreTimer = null;
  }

  _ensureCtx() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();

    this.muteGate = this.ctx.createGain();
    this.muteGate.gain.value = this.muted ? 0 : 1;
    this.muteGate.connect(this.ctx.destination);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.master;
    this.masterGain.connect(this.muteGate);

    this.alertGain = this.ctx.createGain();
    this.alertGain.gain.value = 1.0; // alerts always at full (only muted by gate)
    this.alertGain.connect(this.muteGate);

    this._buildBuffers();
    this._loadMeow();
  }

  async resume() {
    this._ensureCtx();
    if (this.ctx && this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (e) {
        console.warn("AudioContext.resume failed:", e);
      }
    }
  }

  _buildBuffers() {
    const ctx = this.ctx;
    const seconds = 4;
    const sampleRate = ctx.sampleRate;
    const length = seconds * sampleRate;

    // White noise
    this.noiseBuffer = ctx.createBuffer(1, length, sampleRate);
    const w = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) w[i] = Math.random() * 2 - 1;

    // Pink noise (Voss-McCartney approximation)
    this.pinkBuffer = ctx.createBuffer(1, length, sampleRate);
    const p = this.pinkBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const wn = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + wn * 0.0555179;
      b1 = 0.99332 * b1 + wn * 0.0750759;
      b2 = 0.969 * b2 + wn * 0.153852;
      b3 = 0.8665 * b3 + wn * 0.3104856;
      b4 = 0.55 * b4 + wn * 0.5329522;
      b5 = -0.7616 * b5 - wn * 0.016898;
      p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + wn * 0.5362) * 0.11;
      b6 = wn * 0.115926;
    }

    // Brown noise (integrated white)
    this.brownBuffer = ctx.createBuffer(1, length, sampleRate);
    const br = this.brownBuffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const wn = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * wn) / 1.02;
      br[i] = lastOut * 3.5;
    }
  }

  _noiseSource(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0);
    return src;
  }

  _makeRain() {
    const src = this._noiseSource(this.noiseBuffer);
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 900;
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 5500;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.2;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain);
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.7;
    lfoGain.connect(trackGain.gain);
    src.connect(hp).connect(lp).connect(trackGain);
    lfo.start(0);
    return { out: trackGain, nodes: [src, hp, lp, lfo, lfoGain] };
  }

  _makeOcean() {
    const src = this._noiseSource(this.brownBuffer);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 400;
    bp.Q.value = 0.7;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.6;
    lfo.connect(lfoGain);
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.85;
    lfoGain.connect(trackGain.gain);
    src.connect(bp).connect(trackGain);
    lfo.start(0);
    return { out: trackGain, nodes: [src, bp, lfo, lfoGain] };
  }

  _makeForest() {
    const src = this._noiseSource(this.pinkBuffer);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2200;
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.55;
    src.connect(lp).connect(trackGain);

    // Occasional bird-like chirps
    const chirpController = { stop: false, timer: null };
    const scheduleChirp = () => {
      if (chirpController.stop) return;
      const wait = 6000 + Math.random() * 18000;
      chirpController.timer = setTimeout(() => {
        if (chirpController.stop) return;
        this._playChirp(trackGain);
        scheduleChirp();
      }, wait);
    };
    scheduleChirp();

    return {
      out: trackGain,
      nodes: [src, lp],
      teardown: () => {
        chirpController.stop = true;
        if (chirpController.timer) clearTimeout(chirpController.timer);
      },
    };
  }

  _playChirp(connectTo) {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    const start = 2400 + Math.random() * 1800;
    const end = start + (Math.random() * 600 - 300);
    osc.frequency.setValueAtTime(start, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(800, end), t0 + 0.18);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    osc.connect(g).connect(connectTo);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  }

  _makeCafe() {
    const src = this._noiseSource(this.pinkBuffer);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    const tremolo = this.ctx.createOscillator();
    tremolo.frequency.value = 0.6;
    const tremGain = this.ctx.createGain();
    tremGain.gain.value = 0.18;
    tremolo.connect(tremGain);
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.7;
    tremGain.connect(trackGain.gain);
    src.connect(lp).connect(trackGain);
    tremolo.start(0);
    return { out: trackGain, nodes: [src, lp, tremolo, tremGain] };
  }

  _makeLofi() {
    const src = this._noiseSource(this.pinkBuffer);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.55;
    src.connect(lp).connect(trackGain);

    // Faint sine triad pad
    const notes = [196.0, 246.94, 329.63]; // G3, B3, E4
    const padNodes = notes.map((freq) => {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const og = this.ctx.createGain();
      og.gain.value = 0.025;
      o.connect(og).connect(trackGain);
      o.start(0);
      return [o, og];
    });

    return { out: trackGain, nodes: [src, lp, ...padNodes.flat()] };
  }

  _makeWhite() {
    const src = this._noiseSource(this.noiseBuffer);
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = 0.45;
    src.connect(trackGain);
    return { out: trackGain, nodes: [src] };
  }

  _build(key) {
    switch (key) {
      case "rain": return this._makeRain();
      case "ocean": return this._makeOcean();
      case "forest": return this._makeForest();
      case "cafe": return this._makeCafe();
      case "lofi": return this._makeLofi();
      case "white": return this._makeWhite();
      default: return null;
    }
  }

  setMaster(volume) {
    this.master = Math.max(0, Math.min(1, volume));
    this._ensureCtx();
    if (this.masterGain && !this.muted) {
      this._rampGain(this.masterGain.gain, this.master, 0.15);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    this._ensureCtx();
    if (this.masterGain) {
      this._rampGain(this.masterGain.gain, muted ? 0 : this.master, 0.2);
    }
  }

  isPlaying(key) {
    return !!this.tracks[key];
  }

  async enable(key, volume = 0.5) {
    await this.resume();
    if (!this.ctx) return;
    if (this.tracks[key]) {
      this.setVolume(key, volume);
      return;
    }
    const built = this._build(key);
    if (!built) return;
    const userGain = this.ctx.createGain();
    userGain.gain.value = 0;
    built.out.connect(userGain).connect(this.masterGain);
    this.tracks[key] = { ...built, userGain };
    this._rampGain(userGain.gain, Math.max(0, Math.min(1, volume)), 0.6);
  }

  disable(key) {
    const t = this.tracks[key];
    if (!t) return;
    this._rampGain(t.userGain.gain, 0, 0.4);
    const ctx = this.ctx;
    setTimeout(() => {
      try {
        t.nodes.forEach((n) => {
          try { n.stop && n.stop(); } catch (_) {}
          try { n.disconnect && n.disconnect(); } catch (_) {}
        });
        try { t.out.disconnect(); } catch (_) {}
        try { t.userGain.disconnect(); } catch (_) {}
        if (t.teardown) t.teardown();
      } catch (_) {}
      delete this.tracks[key];
    }, 500);
  }

  setVolume(key, volume) {
    const t = this.tracks[key];
    if (!t) return;
    this._rampGain(t.userGain.gain, Math.max(0, Math.min(1, volume)), 0.2);
  }

  _rampGain(param, value, seconds) {
    try {
      const now = this.ctx.currentTime;
      param.cancelScheduledValues(now);
      param.setValueAtTime(param.value, now);
      param.linearRampToValueAtTime(value, now + seconds);
    } catch (_) {
      param.value = value;
    }
  }

  async _loadMeow() {
    if (this.meowLoaded || !this.ctx) return;
    const urls = ["/sounds/meow.mp3", "/sounds/meow_alt.mp3", "/sounds/meow_attention.mp3"];
    const buffers = [];
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr);
        buffers.push(buf);
      } catch (e) {
        console.warn(`failed to load meow asset ${url}:`, e);
      }
    }
    this.meowBuffers = buffers;
    this.meowLoaded = buffers.length > 0;
  }

  /**
   * Play a ~4 second cat meow alert. Chains 2-3 cat meow samples with small gaps.
   * Ducks ambient down to ~25% while playing, then restores.
   * Respects global mute (no audible output when muted, but visual hop still fires upstream).
   */
  async playMeowAlert() {
    await this.resume();
    if (!this.ctx) return 0;
    if (!this.meowLoaded) await this._loadMeow();
    if (!this.meowBuffers.length) return 0;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Duck ambient master
    if (this.duckRestoreTimer) {
      clearTimeout(this.duckRestoreTimer);
      this.duckRestoreTimer = null;
    }
    if (this.masterGain) {
      const duckedTarget = this.master * 0.25;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(duckedTarget, now + 0.2);
    }

    // Chain 3 meows with gaps to fill ~4s
    const playAt = (offset) => {
      const buf = this.meowBuffers[Math.floor(Math.random() * this.meowBuffers.length)];
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      // make meow slightly more prominent — gain >1 with soft cap via the alert bus
      g.gain.setValueAtTime(0, now + offset);
      g.gain.linearRampToValueAtTime(1.1, now + offset + 0.02);
      g.gain.setValueAtTime(1.1, now + offset + buf.duration - 0.08);
      g.gain.linearRampToValueAtTime(0, now + offset + buf.duration);
      src.connect(g).connect(this.alertGain);
      src.start(now + offset);
      src.stop(now + offset + buf.duration + 0.05);
      return buf.duration;
    };

    let cursor = 0;
    const targetTotal = 3.6;
    const gap = 0.35;
    while (cursor < targetTotal) {
      const dur = playAt(cursor);
      cursor += dur + gap;
    }
    const totalMs = Math.round(cursor * 1000);

    // Schedule restore of ambient master
    this.duckRestoreTimer = setTimeout(() => {
      if (this.masterGain && this.ctx) {
        const t = this.ctx.currentTime;
        this.masterGain.gain.cancelScheduledValues(t);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, t);
        this.masterGain.gain.linearRampToValueAtTime(this.master, t + 0.5);
      }
      this.duckRestoreTimer = null;
    }, totalMs + 50);

    return totalMs;
  }
}

const engine = new AmbientEngine();

export { engine, TRACK_KEYS, TRACK_META };
