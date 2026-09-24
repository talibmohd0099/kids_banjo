// Small synthesized instruments for the Magic Orchestra. Each call schedules
// one note at an exact audio-clock time, which keeps the band perfectly in time.

import { midiToFreq } from '../music/theory';
import type { AudioEngine } from './engine';

function envGain(ctx: AudioContext, dest: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function noiseSource(e: AudioEngine, t: number, dur: number): AudioBufferSourceNode {
  const n = e.ctx.createBufferSource();
  n.buffer = e.noiseBuffer();
  n.start(t, Math.random());
  n.stop(t + dur);
  return n;
}

export function piano(e: AudioEngine, dest: AudioNode, midi: number, t: number, vel = 0.5, dur = 1.6): void {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const g = envGain(ctx, dest, t, 0.12 * vel, 0.005, dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3000 * (0.5 + vel), t);
  lp.frequency.exponentialRampToValueAtTime(600, t + dur);
  lp.connect(g);
  const parts: [OscillatorType, number, number][] = [
    ['triangle', 1, 1],
    ['sine', 2, 0.35],
    ['sine', 3, 0.12],
  ];
  for (const [type, mult, amt] of parts) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mult;
    const og = ctx.createGain();
    og.gain.value = amt;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

export function bass(e: AudioEngine, dest: AudioNode, midi: number, t: number, vel = 0.6, dur = 0.9): void {
  const ctx = e.ctx;
  const g = envGain(ctx, dest, t, 0.28 * vel, 0.01, dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.connect(g);
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = midiToFreq(midi);
  o.connect(lp);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function flute(e: AudioEngine, dest: AudioNode, midi: number, t: number, vel = 0.4, dur = 1.5): void {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const g = ctx.createGain();
  const peakLevel = 0.09 * vel;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peakLevel, t + 0.09);
  g.gain.setValueAtTime(peakLevel, t + Math.max(0.1, dur - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(dest);

  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = f;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = f * 0.006;
  lfo.connect(lfoAmt).connect(o.frequency);
  o.connect(g);

  const breath = noiseSource(e, t, dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f * 2;
  bp.Q.value = 6;
  const bg = ctx.createGain();
  bg.gain.value = 0.25;
  breath.connect(bp).connect(bg).connect(g);

  o.start(t);
  lfo.start(t);
  o.stop(t + dur + 0.05);
  lfo.stop(t + dur + 0.05);
}

export function kick(e: AudioEngine, dest: AudioNode, t: number, vel = 0.8): void {
  const ctx = e.ctx;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  o.connect(envGain(ctx, dest, t, 0.55 * vel, 0.003, 0.3));
  o.start(t);
  o.stop(t + 0.35);
}

export function snare(e: AudioEngine, dest: AudioNode, t: number, vel = 0.6): void {
  const ctx = e.ctx;
  const n = noiseSource(e, t, 0.2);
  const bp = ctx.createBiquadFilter();
  bp.type = 'highpass';
  bp.frequency.value = 1400;
  n.connect(bp).connect(envGain(ctx, dest, t, 0.22 * vel, 0.002, 0.16));
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = 190;
  o.connect(envGain(ctx, dest, t, 0.12 * vel, 0.002, 0.08));
  o.start(t);
  o.stop(t + 0.12);
}

export function hat(e: AudioEngine, dest: AudioNode, t: number, vel = 0.4): void {
  const ctx = e.ctx;
  const n = noiseSource(e, t, 0.08);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7500;
  n.connect(hp).connect(envGain(ctx, dest, t, 0.1 * vel, 0.001, 0.05));
}

export function cymbal(e: AudioEngine, dest: AudioNode, t: number, vel = 0.6): void {
  const ctx = e.ctx;
  const n = noiseSource(e, t, 2.2);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  n.connect(hp).connect(envGain(ctx, dest, t, 0.12 * vel, 0.004, 2));
}

/** Many tiny filtered noise bursts = a crowd clapping. */
export function applause(e: AudioEngine, dest: AudioNode, t: number, seconds = 3): void {
  const ctx = e.ctx;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(1, t + 0.3);
  out.gain.setValueAtTime(1, t + seconds - 1);
  out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  bp.connect(out).connect(dest);
  const claps = Math.floor(seconds * 45);
  for (let i = 0; i < claps; i++) {
    const ct = t + Math.random() * seconds;
    const n = noiseSource(e, ct, 0.03);
    n.connect(envGain(ctx, bp, ct, 0.05 + Math.random() * 0.06, 0.001, 0.025));
  }
}
