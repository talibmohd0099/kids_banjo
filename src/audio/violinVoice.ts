// A synthesized bowed string.
//
// Two slightly detuned sawtooth waves (a bowed string's wave is close to a sawtooth)
// go through filters shaped like a violin body: a wooden low resonance, the bright
// "bridge hill" around 3 kHz, and a tone filter that opens up the harder you bow.
// Filtered noise adds bow hair "rosin" texture. A slow wobble on the pitch is vibrato.

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

const VIBRATO_RATE = 5.6; // Hz, a typical violinist's vibrato
const VIBRATO_CENTS = 28;

export class ViolinVoice {
  private oscs: OscillatorNode[];
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private tone: BiquadFilterNode;
  private amp: GainNode;
  private noise: AudioBufferSourceNode;
  private noiseFilter: BiquadFilterNode;
  private noiseGain: GainNode;
  private stopped = false;

  constructor(private engine: AudioEngine, start: VoiceControls) {
    const ctx = engine.ctx;
    const t = ctx.currentTime;
    const freq = midiToFreq(start.midi);

    this.oscs = [0, 7].map((detune) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = detune;
      return o;
    });

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = VIBRATO_RATE;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    for (const o of this.oscs) this.lfoGain.connect(o.detune);

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    for (const o of this.oscs) o.connect(mix);

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
    this.noise.start(t, Math.random());

    // A quick bite at the start, like the bow catching the string.
    this.bite(t, start.intensity);
    this.set(start, true);
  }

  /** Update the sound; called every frame with the latest finger state. */
  set(c: VoiceControls, immediate = false): void {
    if (this.stopped) return;
    const ctx = this.engine.ctx;
    const t = ctx.currentTime;
    const glide = immediate ? 0.005 : 0.03;
    const freq = midiToFreq(c.midi);
    for (const o of this.oscs) o.frequency.setTargetAtTime(freq, t, glide);
    this.noiseFilter.frequency.setTargetAtTime(freq * 3, t, glide);

    const i = Math.max(0, Math.min(1, c.intensity));
    // Down bow is a touch stronger and brighter; up bow a little softer and darker.
    const dirGain = c.direction === 'down' ? 1 : 0.88;
    const dirBright = c.direction === 'down' ? 1.12 : 0.9;
    const level = Math.pow(i, 1.4) * 0.34 * dirGain;
    this.amp.gain.setTargetAtTime(level, t, 0.025);
    this.tone.frequency.setTargetAtTime((900 + 5200 * i) * dirBright, t, 0.04);
    this.noiseGain.gain.setTargetAtTime(0.05 + 0.1 * i, t, 0.05);
    this.lfoGain.gain.setTargetAtTime(c.vibrato * VIBRATO_CENTS, t, 0.08);

    if (c.bowChanged) this.bite(t, i);
  }

  /** Bow change: a tiny dip then a scratchy re-attack. */
  private bite(t: number, intensity: number): void {
    const g = this.noiseGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.25 + 0.3 * intensity, t);
    g.setTargetAtTime(0.05 + 0.1 * intensity, t + 0.02, 0.04);
  }

  release(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.engine.ctx.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.08);
    const end = t + 0.6;
    for (const o of this.oscs) o.stop(end);
    this.lfo.stop(end);
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
