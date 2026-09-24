// Where violin voices come from. The app talks only to the ViolinSound interface,
// so the sound source can be swapped without touching the screens or the games:
//
//   synthViolin   : built-in synthesized violin (the placeholder used today, no files needed)
//   SampledViolin : real recorded violin notes. Drop recordings into public/samples/violin/
//                   with a manifest.json and they are picked up automatically at startup.
//
// manifest.json example:
//   { "samples": [ { "midi": 55, "url": "G3.m4a", "loopStart": 0.4, "loopEnd": 1.6 }, ... ] }
// Record one sustained note every 3-4 semitones; the nearest one is re-pitched for the rest.

import { midiToFreq } from '../music/theory';
import type { AudioEngine } from './engine';
import { ViolinVoice, type VoiceControls } from './violinVoice';

export interface SoundingVoice {
  set(c: VoiceControls, immediate?: boolean): void;
  release(): void;
}

export interface ViolinSound {
  readonly name: string;
  createVoice(engine: AudioEngine, start: VoiceControls): SoundingVoice;
}

export const synthViolin: ViolinSound = {
  name: 'synth',
  createVoice: (engine, start) => new ViolinVoice(engine, start),
};

export interface SampleInfo {
  midi: number;
  url: string;
  loopStart?: number; // seconds; the sustained middle of the note
  loopEnd?: number;
}

interface LoadedSample extends SampleInfo {
  buffer: AudioBuffer;
}

/** Nearest recorded note to a pitch (pure helper, unit tested). */
export function nearestSample<T extends { midi: number }>(samples: readonly T[], midi: number): T {
  let best = samples[0];
  for (const s of samples) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  return best;
}

export class SampledViolin implements ViolinSound {
  readonly name = 'samples';
  constructor(private samples: LoadedSample[]) {}

  createVoice(engine: AudioEngine, start: VoiceControls): SoundingVoice {
    return new SampledVoice(engine, nearestSample(this.samples, start.midi), start);
  }
}

const VIBRATO_CENTS = 28;

class SampledVoice implements SoundingVoice {
  private src: AudioBufferSourceNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private tone: BiquadFilterNode;
  private amp: GainNode;
  private stopped = false;

  constructor(private engine: AudioEngine, private sample: LoadedSample, start: VoiceControls) {
    const ctx = engine.ctx;
    const t = ctx.currentTime;
    this.src = ctx.createBufferSource();
    this.src.buffer = sample.buffer;
    this.src.loop = true;
    this.src.loopStart = sample.loopStart ?? sample.buffer.duration * 0.3;
    this.src.loopEnd = sample.loopEnd ?? sample.buffer.duration * 0.8;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.6;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain).connect(this.src.detune);
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.src.connect(this.tone).connect(this.amp).connect(engine.input);
    this.src.start(t);
    this.lfo.start(t);
    this.set(start, true);
  }

  set(c: VoiceControls, immediate = false): void {
    if (this.stopped) return;
    const t = this.engine.ctx.currentTime;
    const rate = midiToFreq(c.midi) / midiToFreq(this.sample.midi);
    this.src.playbackRate.setTargetAtTime(rate, t, immediate ? 0.005 : 0.03);
    const i = Math.max(0, Math.min(1, c.intensity));
    const dir = c.direction === 'down' ? 1 : 0.88;
    this.amp.gain.setTargetAtTime(Math.pow(i, 1.3) * 0.6 * dir, t, 0.03);
    this.tone.frequency.setTargetAtTime(1500 + 9000 * i, t, 0.04);
    this.lfoGain.gain.setTargetAtTime(c.vibrato * VIBRATO_CENTS, t, 0.08);
  }

  release(): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.engine.ctx.currentTime;
    this.amp.gain.cancelScheduledValues(t);
    this.amp.gain.setTargetAtTime(0, t, 0.08);
    this.src.stop(t + 0.6);
    this.lfo.stop(t + 0.6);
  }
}

let current: ViolinSound = synthViolin;

export function violinSound(): ViolinSound {
  return current;
}

/**
 * Try to load recorded samples. Resolves to the sound in use afterwards; when the
 * manifest is missing or anything fails, the synth stays in place.
 */
export async function loadViolinSamples(engine: AudioEngine, base = 'samples/violin/'): Promise<ViolinSound> {
  try {
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) return current;
    const manifest = (await res.json()) as { samples: SampleInfo[] };
    const loaded = await Promise.all(
      manifest.samples.map(async (s) => {
        const data = await (await fetch(base + s.url)).arrayBuffer();
        return { ...s, buffer: await engine.ctx.decodeAudioData(data) };
      }),
    );
    if (loaded.length) current = new SampledViolin(loaded);
  } catch {
    /* keep the synth */
  }
  return current;
}
