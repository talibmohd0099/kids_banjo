// Music helpers shared by the violin, the songs, the game and the orchestra.
// Pitches are MIDI numbers (60 = middle C). Floats are allowed for pitch bends.

export interface ViolinString {
  name: 'G' | 'D' | 'A' | 'E';
  openMidi: number;
  color: string;
}

export const STRINGS: readonly ViolinString[] = [
  { name: 'G', openMidi: 55, color: '#ff8a5b' },
  { name: 'D', openMidi: 62, color: '#ffd166' },
  { name: 'A', openMidi: 69, color: '#06d6a0' },
  { name: 'E', openMidi: 76, color: '#4cc9f0' },
];

/** Highest semitone a finger can reach on one string (first position + a stretch). */
export const MAX_POSITION = 7;

/** Everything in the MVP is in D major, the friendliest key on a violin. */
export const KEY_ROOT_PC = 2; // D
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function inKey(midi: number): boolean {
  return MAJOR_STEPS.includes((pitchClass(midi) - KEY_ROOT_PC + 12) % 12);
}

export type LabelStyle = 'letters' | 'solfege' | 'sargam';

const SOLFEGE = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'];
const SARGAM = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'];

/**
 * Name for a note. Do-Re-Mi and Sa-Re-Ga are "movable": the key note (D) is Do / Sa,
 * so the songs read the same way kids sing them.
 */
export function noteLabel(midi: number, style: LabelStyle = 'letters'): string {
  const pc = pitchClass(midi);
  if (style === 'letters') return LETTERS[pc];
  const degree = MAJOR_STEPS.indexOf((pc - KEY_ROOT_PC + 12) % 12);
  if (degree < 0) return LETTERS[pc];
  return (style === 'solfege' ? SOLFEGE : SARGAM)[degree];
}

/** Parse "F#4" / "Bb3" into a MIDI number. */
export function parseNote(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name.trim());
  if (!m) throw new Error(`Bad note name: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

/**
 * Which string and finger position plays a note. Prefers the highest string that can
 * reach it, so open strings are used whenever possible (easiest for beginners).
 */
export function stringForNote(midi: number): { string: number; position: number } | null {
  for (let s = STRINGS.length - 1; s >= 0; s--) {
    const pos = midi - STRINGS[s].openMidi;
    if (pos >= 0 && pos <= MAX_POSITION) return { string: s, position: pos };
  }
  return null;
}

export type AssistLevel = 'beginner' | 'explorer' | 'free';

/**
 * How much the app helps the finger land on a "good" note.
 * beginner: snaps fully to the nearest note of the song's key.
 * explorer: pulls gently towards the nearest semitone (you can still bend).
 * free: exactly where the finger is.
 */
export function assistPitch(openMidi: number, rawPosition: number, level: AssistLevel): number {
  const raw = openMidi + rawPosition;
  if (level === 'free') return raw;
  if (level === 'explorer') {
    const nearest = Math.round(raw);
    return nearest + (raw - nearest) * 0.35;
  }
  let best = Math.round(raw);
  let bestDist = Infinity;
  for (let p = 0; p <= MAX_POSITION; p++) {
    const m = openMidi + p;
    if (!inKey(m)) continue;
    const d = Math.abs(m - raw);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best;
}

// Chords the orchestra uses in D major: I, IV, V, vi.
export interface Chord {
  name: string;
  rootMidi: number; // bass root (octave 2/3)
  pcs: number[];
}

export const CHORDS: readonly Chord[] = [
  { name: 'D', rootMidi: 50, pcs: [2, 6, 9] },
  { name: 'G', rootMidi: 43, pcs: [7, 11, 2] },
  { name: 'A', rootMidi: 45, pcs: [9, 1, 4] },
  { name: 'Bm', rootMidi: 47, pcs: [11, 2, 6] },
];

/**
 * Pick the chord that best fits a bunch of melody notes (weighted by how long each lasts).
 * Ties go to the earlier chord in the list, so the home chord wins when unsure.
 */
export function chooseChord(notes: { midi: number; weight: number }[], fallback = 0): number {
  if (notes.length === 0) return fallback;
  let best = fallback;
  let bestScore = -1;
  CHORDS.forEach((chord, i) => {
    let score = 0;
    for (const n of notes) if (chord.pcs.includes(pitchClass(n.midi))) score += n.weight;
    // Small bonus for staying on the same chord, which sounds calmer.
    if (i === fallback) score += 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}
