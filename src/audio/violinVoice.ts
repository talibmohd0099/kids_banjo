// A synthesized bowed string (the placeholder until real samples are added).
//
// The main wave has a bowed-string harmonic recipe; a quieter sawtooth slightly
// detuned adds warmth. They go through filters shaped like a violin body: a wooden
// low resonance, the bright "bridge hill" around 3 kHz, and a tone filter that opens
// up the harder you bow. Filtered noise adds bow hair "rosin" texture.
//
// What makes it sound played rather than electronic:
//  - each bow stroke starts a little flat and slides into tune (like a real finger),
//  - long notes grow a natural vibrato after a moment, as violinists do,
//  - the pitch drifts by a hair, so it never sounds perfectly machine-steady.

import { midiToFreq } from '../music/theory';
import type { AudioEngine } from './engine';
import type { BowDirection } from '../input/gesture';

export interface VoiceControls {
  midi: number; // may be fractional (pitch bend)
  intensity: number; // 0..1
  vibrato: number; // 0..1
  direction: BowDirection;
  bowChanged?: boolean;
}

const VIBRATO_CENTS = 28;
const SCOOP_CENTS = -22; // how flat a stroke starts before sliding into tune
const AUTO_VIBRATO_DELAY = 0.35; // seconds into a note before vibrato starts
const AUTO_VIBRATO_DEPTH = 0.55;

// Relative strength of harmonics 1..20 for a bowed string (bright, sawtooth-like,
// with the body filters below doing the rest).
const HARMONICS = [1, 0.8, 0.68, 0.52, 0.47, 0.38, 0.3, 0.27, 0.22, 0.2, 0.16, 0.14, 0.12, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.045];
const waves = new WeakMap<BaseAudioContext, PeriodicWave>();

function bowedWave(ctx: BaseAudioContext): PeriodicWave {
  let w = waves.get(ctx);
  if (!w) {
    const real = new Float32Array(HARMONICS.length + 1);
    const imag = new Float32Array(HARMONICS.length + 1);
    HARMONICS.forEach((a, i) => (imag[i + 1] = a));
    w = ctx.createPeriodicWave(real, imag);
    waves.set(ctx, w);
  }
  return w;
}

export class ViolinVoice {
  private oscs: OscillatorNode[];
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private tone: BiquadFilterNode;
  private amp: GainNode;
  private noise: AudioBufferSourceNode;
  private noiseFilter: BiquadFilterNode;
  private noiseGain: GainNode;
  private drift: OscillatorNode;
  private strokeStart = 0;
  private stopped = false;

  constructor(private engine: AudioEngine, start: VoiceControls) {
    const ctx = engine.ctx;
    const t = ctx.currentTime;
    const freq = midiToFreq(start.midi);

    const main = ctx.createOscillator();
    main.setPeriodicWave(bowedWave(ctx));
    const warm = ctx.createOscillator();
    warm.type = 'sawtooth';
    warm.detune.value = 6;
    this.oscs = [main, warm];
    for (const o of this.oscs) o.frequency.value = freq;

    // Vibrato, at a slightly different speed for every note like a real player.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.2 + Math.random() * 0.8;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    for (const o of this.oscs) this.lfoGain.connect(o.detune);
    // A tiny slow drift of pitch (a few cents).
    this.drift = ctx.createOscillator();
    this.drift.frequency.value = 0.6 + Math.random() * 0.6;
    const driftAmt = ctx.createGain();
    driftAmt.gain.value = 3;
    this.drift.connect(driftAmt);
    for (const o of this.oscs) driftAmt.connect(o.detune);

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const mainGain = ctx.createGain();
    mainGain.gain.value = 0.75;
    const warmGain = ctx.createGain();
    warmGain.gain.value = 0.35;
    main.connect(mainGain).connect(mix);
    warm.connect(warmGain).connect(mix);

    // Violin body resonances.
    const wood = peak(ctx, 290, 1.4, 7);
    const air = peak(ctx, 520, 2, 3);
    const bridge = peak(ctx, 2900, 1.1, 6);
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf';
    shelf.frequency.value = 6000;
    shelf.gain.value = -12;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 170;

    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.Q.value = 0.7;
    this.tone.frequency.value = 1500;

    this.amp = ctx.createGain();
    this.amp.gain.value = 0;

    // Bow hair noise, tuned near the note so it blends in.
    this.noise = ctx.createBufferSource();
    this.noise.buffer = engine.noiseBuffer();
    this.noise.loop = true;
    this.noise.loopStart = Math.random();
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'bandpass';
    this.noiseFilter.Q.value = 3;
    this.noiseFilter.frequency.value = freq * 3;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;

    mix.connect(highpass).connect(wood).connect(air).connect(bridge).connect(shelf).connect(this.tone).connect(this.amp);
    this.noise.connect(this.noiseFilter).connect(this.noiseGain).connect(this.amp);
    this.amp.connect(engine.input);

    for (const o of this.oscs) o.start(t);
    this.lfo.start(t);
    this.drift.start(t);
    this.noise.start(t, Math.random());

    // A quick bite at the start, like the bow catching the string.
    this.strokeStart = t;
    this.set(start, true);
    this.stroke(t, freq, start.intensity);
  }

  /** Update the sound; called every frame with the latest finger state. */
  set(c: VoiceControls, immediate = false): void {
    if (this.stopped) return;
    const ctx = this.engine.ctx;
    const t = ctx.currentTime;
    const glide = immediate ? 0.005 : 0.03;
    const freq = midiToFreq(c.midi);
    if (c.bowChanged) this.stroke(t, freq, c.intensity);
    else for (const o of this.oscs) o.frequency.setTargetAtTime(freq, t, glide);
    this.noiseFilter.frequency.setTargetAtTime(freq * 3, t, glide);

    const i = Math.max(0, Math.min(1, c.intensity));
    // Down bow is a touch stronger and brighter; up bow a little softer and darker.
    const dirGain = c.direction === 'down' ? 1 : 0.88;
    const dirBright = c.direction === 'down' ? 1.12 : 0.9;
    const level = Math.pow(i, 1.4) * 0.34 * dirGain;
    this.amp.gain.setTargetAtTime(level, t, 0.025);
    this.tone.frequency.setTargetAtTime((900 + 5200 * i) * dirBright, t, 0.04);
    this.noiseGain.gain.setTargetAtTime(0.05 + 0.1 * i, t, 0.05);
    // Natural vibrato grows on a sustained note; a finger wiggle can add more.
    const held = t - this.strokeStart - AUTO_VIBRATO_DELAY;
    const auto = i > 0.15 ? Math.max(0, Math.min(1, held / 0.5)) * AUTO_VIBRATO_DEPTH : 0;
    this.lfoGain.gain.setTargetAtTime(Math.max(c.vibrato, auto) * VIBRATO_CENTS, t, 0.08);
  }

  /** A new bow stroke: scratchy bite, and the pitch slides up into tune. */
  private stroke(t: number, freq: number, intensity: number): void {
    this.strokeStart = t;
    // The bow stops for an instant when it changes direction: a short dip in volume
    // makes repeated notes (like "Mary had a little lamb, little lamb") sound separate.
    const amp = this.amp.gain;
    amp.cancelScheduledValues(t);
    amp.setValueAtTime(amp.value * 0.15, t);
    const g = this.noiseGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.25 + 0.3 * intensity, t);
    g.setTargetAtTime(0.05 + 0.1 * intensity, t + 0.02, 0.04);
    const scooped = freq * Math.pow(2, SCOOP_CENTS / 1200);
    for (const o of this.oscs) {
      o.frequency.cancelScheduledValues(t);
      o.frequency.setValueAtTime(scooped, t);
      o.frequency.setTargetAtTime(freq, t, 0.025);
    }
  }

  release(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.engine.ctx.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.05);
    const end = t + 0.6;
    for (const o of this.oscs) o.stop(end);
    this.lfo.stop(end);
    this.drift.stop(end);
    this.noise.stop(end);
    setTimeout(() => this.amp.disconnect(), 800);
  }
}

function peak(ctx: AudioContext, freq: number, q: number, gain: number): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}
