// The Magic Orchestra band: piano, bass, drums and flute play along with the child.
// A look-ahead scheduler books each eighth-note slightly in advance on the audio
// clock, which is the standard way to get rock-steady timing in Web Audio.

import { CHORDS } from '../music/theory';
import type { AudioEngine } from './engine';
import { Arranger, type Layers, NO_LAYERS } from './arranger';
import { synthBank, type InstrumentBank } from './instruments';

export interface OrchestraOptions {
  tempo: number;
  beatsPerBar: number;
  /**
   * Optional external clock (used by song games): returns the current song beat,
   * or null when the song is not running. Without it the band keeps its own time.
   */
  beatClock?: () => number | null;
  /** Optional fixed harmony (song games): chord index for a beat. */
  chordAt?: (beat: number) => number;
  /** Optional fixed layers (song games decide who plays based on progress). */
  layersOverride?: () => Layers | null;
  /** Instrument sounds; defaults to the built-in synthesized band. */
  bank?: InstrumentBank;
}

const LOOKAHEAD = 0.12; // seconds
const TICK_MS = 25;

export class Orchestra {
  readonly arranger = new Arranger();
  private out: GainNode;
  private timer: number | null = null;
  private startTime = 0;
  private nextStep = 0; // index of the next eighth-note to schedule
  private current: Layers = { ...NO_LAYERS };
  onLayersChange: ((l: Layers) => void) | null = null;
  private bank: InstrumentBank;

  constructor(private engine: AudioEngine, private opts: OrchestraOptions) {
    this.bank = opts.bank ?? synthBank;
    this.out = engine.ctx.createGain();
    this.out.gain.value = 0.8;
    this.out.connect(engine.input);
  }

  get layers(): Layers {
    return this.current;
  }

  start(): void {
    if (this.timer !== null) return;
    this.startTime = this.engine.now + 0.05;
    this.nextStep = 0;
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.out.gain.setTargetAtTime(0, this.engine.now, 0.3);
    const out = this.out;
    setTimeout(() => out.disconnect(), 1500);
    this.setLayers({ ...NO_LAYERS });
  }

  /** The big finish: full band, a cymbal crash, a final chord and applause. */
  finale(): void {
    const e = this.engine;
    const t = e.now + 0.05;
    this.arranger.climax(e.now, 4);
    this.bank.cymbal(e, this.out, t, 0.8);
    this.bank.kick(e, this.out, t, 1);
    const chord = CHORDS[0];
    for (const m of voice(chord.pcs)) this.bank.piano(e, this.out, m, t, 0.9, 3);
    this.bank.bass(e, this.out, chord.rootMidi - 12, t, 0.9, 2.5);
    this.bank.flute(e, this.out, 74, t, 0.7, 2.5);
    this.bank.applause(e, this.out, t + 0.6, 3.5);
  }

  private secPerBeat(): number {
    return 60 / this.opts.tempo;
  }

  private tick(): void {
    const e = this.engine;
    const now = e.now;
    const layers = this.opts.layersOverride?.() ?? this.arranger.layers(now);
    this.setLayers(layers);

    const spb = this.secPerBeat();
    let beatNow: number;
    let beatToTime: (b: number) => number;
    if (this.opts.beatClock) {
      const b = this.opts.beatClock();
      if (b === null) return;
      beatNow = b;
      beatToTime = (x) => now + (x - b) * spb;
      // Never schedule into the past if the song jumped ahead.
      const minStep = Math.ceil(b * 2);
      if (this.nextStep < minStep) this.nextStep = minStep;
    } else {
      beatNow = (now - this.startTime) / spb;
      beatToTime = (x) => this.startTime + x * spb;
    }

    const horizon = beatNow + LOOKAHEAD / spb;
    while (this.nextStep / 2 <= horizon) {
      const beat = this.nextStep / 2;
      this.playStep(this.nextStep, Math.max(now, beatToTime(beat)), layers, beat);
      this.nextStep++;
    }
  }

  private playStep(step: number, t: number, layers: Layers, beat: number): void {
    const e = this.engine;
    const stepsPerBar = this.opts.beatsPerBar * 2;
    const s = step % stepsPerBar;
    const onBeat = s % 2 === 0;
    const beatInBar = s / 2;
    const halfBar = this.opts.beatsPerBar === 4 ? 2 : this.opts.beatsPerBar;
    const climax = this.arranger.inClimax(e.now);
    const vel = climax ? 1 : 0.6;

    // Choose the chord at the start of each half bar.
    const chordIdx = this.opts.chordAt ? this.opts.chordAt(beat) : this.arranger.chordFor(e.now);
    const chord = CHORDS[chordIdx];
    const notes = voice(chord.pcs);

    if (layers.piano && onBeat) {
      if (beatInBar % halfBar === 0) {
        for (const m of notes) this.bank.piano(e, this.out, m, t, vel * 0.8, 1.8);
      } else if (!layers.drums) {
        // Gentle broken chord between the big chords.
        this.bank.piano(e, this.out, notes[beatInBar % notes.length] + 12, t, vel * 0.45, 1.2);
      }
    }
    if (layers.bass && onBeat && beatInBar % halfBar === 0) {
      const fifth = beatInBar === 0 ? 0 : 7;
      this.bank.bass(e, this.out, chord.rootMidi + fifth - 12, t, vel, this.secPerBeat() * halfBar * 0.9);
    }
    if (layers.drums) {
      if (onBeat && beatInBar === 0) this.bank.kick(e, this.out, t, vel);
      if (this.opts.beatsPerBar === 4) {
        if (onBeat && beatInBar === 2) this.bank.kick(e, this.out, t, vel * 0.8);
        if (onBeat && (beatInBar === 1 || beatInBar === 3)) this.bank.snare(e, this.out, t, vel);
      } else if (onBeat && beatInBar > 0) {
        this.bank.snare(e, this.out, t, vel * 0.6);
      }
      this.bank.hat(e, this.out, t, onBeat ? vel * 0.8 : vel * 0.5);
    }
    if (layers.flute && s === 0) {
      // The chord's third, up high: a sweet line floating over the violin.
      const third = notes[1] + 12;
      this.bank.flute(e, this.out, third, t, vel * 0.8, this.secPerBeat() * this.opts.beatsPerBar * 0.95);
    }
  }

  private setLayers(l: Layers): void {
    const c = this.current;
    if (c.piano === l.piano && c.bass === l.bass && c.drums === l.drums && c.flute === l.flute) return;
    this.current = { ...l };
    this.onLayersChange?.(this.current);
  }
}

/** Put chord notes in a comfortable piano range (A3..A4). */
export function voice(pcs: number[]): number[] {
  return pcs.map((pc) => {
    let m = 57 + ((pc - 57) % 12 + 12) % 12;
    if (m > 69) m -= 12;
    return m;
  });
}
