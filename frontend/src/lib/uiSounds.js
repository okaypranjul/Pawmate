/**
 * Tiny generated UI sound effects via Web Audio API.
 * All sounds respect the ambient engine's master/mute state.
 */
import { engine } from "./audio";

function play(noteFn) {
  if (!engine || !engine.ctx || engine.muted) return;
  noteFn();
}

function _tone({ freq, freq2, duration = 0.18, type = "sine", vol = 0.12 }) {
  const ctx = engine.ctx;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, t0 + duration);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol * (engine.master || 0.7), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const ui = {
  click: () => play(() => _tone({ freq: 660, freq2: 880, duration: 0.08, vol: 0.06 })),
  open: () => play(() => {
    _tone({ freq: 523, freq2: 659, duration: 0.14, vol: 0.08 });
    setTimeout(() => _tone({ freq: 659, freq2: 784, duration: 0.14, vol: 0.06 }), 60);
  }),
  pet: () => play(() => {
    _tone({ freq: 880, freq2: 1175, duration: 0.16, vol: 0.1, type: "triangle" });
  }),
  complete: () => play(() => {
    _tone({ freq: 523, duration: 0.2, vol: 0.12, type: "triangle" });
    setTimeout(() => _tone({ freq: 659, duration: 0.2, vol: 0.12, type: "triangle" }), 120);
    setTimeout(() => _tone({ freq: 784, duration: 0.32, vol: 0.14, type: "triangle" }), 250);
  }),
  chime: () => play(() => {
    _tone({ freq: 988, duration: 0.55, vol: 0.12, type: "sine" });
    setTimeout(() => _tone({ freq: 1319, duration: 0.65, vol: 0.1, type: "sine" }), 200);
  }),
  reminder: () => play(() => {
    _tone({ freq: 740, freq2: 988, duration: 0.18, vol: 0.1, type: "triangle" });
    setTimeout(() => _tone({ freq: 988, freq2: 1319, duration: 0.22, vol: 0.1, type: "triangle" }), 140);
  }),
};

export default ui;
