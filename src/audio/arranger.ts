// The "brain" of the Magic Orchestra: listens to how the child plays and decides
// which band members join in and which chord fits. Pure logic, unit tested.
//
//   slow / gentle playing        -> piano softly accompanies
//   keeps playing for a while    -> bass joins
//   fast or strong playing       -> drums join
//   long, confident playing      -> flute adds a counter-melody
//   song completed               -> everyone together: the climax

import { chooseChord } from '../music/theory';

export interface Layers {
  piano: boolean;
  bass: boolean;
  drums: boolean;
  flute: boolean;
}

export const NO_LAYERS: Layers = { piano: false, bass: false, drums: false, flute: false };
export const ALL_LAYERS: Layers = { piano: true, bass: true, drums: true, flute: true };

interface NoteEvent {
  midi: number;
  t: number; // seconds
}

const QUIET_GAP = 3; // seconds of silence before the band rests
const WINDOW = 4; // seconds of history used for "how fast"

export class Arranger {
  private notes: NoteEvent[] = [];
  private intensities: { t: number; v: number }[] = [];
  private activeSince: number | null = null;
  private lastActive = -Infinity;
  private climaxUntil = -Infinity;
  private chord = 0;

  /** A new note started (touch, string change, bow change or big pitch move). */
  noteOn(midi: number, t: number): void {
    this.notes.push({ midi, t });
    this.markActive(t);
    this.trim(t);
  }

  /** Called regularly while strings sound, with the loudest current intensity. */
  activity(intensity: number, t: number): void {
    this.intensities.push({ t, v: intensity });
    if (intensity > 0.12) this.markActive(t);
    this.trim(t);
  }

  climax(t: number, seconds: number): void {
    this.climaxUntil = t + seconds;
  }

  inClimax(t: number): boolean {
    return t < this.climaxUntil;
  }

  notesPerSecond(t: number): number {
    const recent = this.notes.filter((n) => t - n.t <= WINDOW);
    return recent.length / WINDOW;
  }

  averageIntensity(t: number): number {
    const recent = this.intensities.filter((i) => t - i.t <= 1.5);
    if (recent.length === 0) return 0;
    return recent.reduce((a, b) => a + b.v, 0) / recent.length;
  }

  layers(t: number): Layers {
    if (this.inClimax(t)) return { ...ALL_LAYERS };
    if (t - this.lastActive > QUIET_GAP || this.activeSince === null) return { ...NO_LAYERS };
    const playingFor = t - this.activeSince;
    const nps = this.notesPerSecond(t);
    const loud = this.averageIntensity(t);
    return {
      piano: true,
      bass: playingFor > 4,
      drums: nps >= 1.5 || loud > 0.7,
      flute: playingFor > 10 && nps >= 0.8,
    };
  }

  /** Chord that fits what was played in the last couple of seconds (recent notes count more). */
  chordFor(t: number): number {
    const recent = this.notes.filter((n) => t - n.t <= 2.5);
    const weighted = recent.map((n) => ({ midi: n.midi, weight: 1 / (1 + (t - n.t)) }));
    this.chord = chooseChord(weighted, this.chord);
    return this.chord;
  }

  private markActive(t: number): void {
    if (t - this.lastActive > QUIET_GAP || this.activeSince === null) this.activeSince = t;
    this.lastActive = t;
  }

  private trim(t: number): void {
    while (this.notes.length && t - this.notes[0].t > WINDOW + 1) this.notes.shift();
    while (this.intensities.length && t - this.intensities[0].t > 2) this.intensities.shift();
  }
}
